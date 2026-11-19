
import base64
import binascii
import hashlib
import hmac
import os
import re
import secrets
import sqlite3
import unicodedata

from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional, Any

from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from jose import jwt, JWTError


# =====================================================
# APP CONFIGURATION
# =====================================================

Shape = Literal["cube", "sphere", "cylinder", "cone", "torus"]

app = FastAPI(
    title="PolyGen API",
    description="AI-powered Text-to-3D and Image-to-3D Asset Generation",
    version="1.3.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =====================================================
# REQUEST MODELS
# =====================================================

class SignupRequest(BaseModel):
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=1, max_length=128)


class PromptRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=1000)


class ImageValidationRequest(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    content_type: str
    image_base64: str = Field(min_length=1, max_length=12_000_000)


class CreationCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    prompt: Optional[str] = Field(default="", max_length=2000)
    object_type: Optional[str] = None
    shape: Optional[str] = None
    color: str = Field(min_length=1, max_length=50)
    width: Optional[float] = None
    height: Optional[float] = None
    depth: Optional[float] = None
    dimensions: Optional[dict[str, Any]] = None
    creation_data: Optional[str] = "{}"

    def get_object_type(self) -> str:
        val = self.object_type or self.shape or "cube"
        return val.lower().strip()

    def get_dimensions(self) -> tuple[float, float, float]:
        w = self.width
        h = self.height
        d = self.depth
        if self.dimensions:
            if w is None and "width" in self.dimensions:
                try:
                    w = float(self.dimensions["width"])
                except (ValueError, TypeError):
                    w = 1.5
            if h is None and "height" in self.dimensions:
                try:
                    h = float(self.dimensions["height"])
                except (ValueError, TypeError):
                    h = 1.5
            if d is None and "depth" in self.dimensions:
                try:
                    d = float(self.dimensions["depth"])
                except (ValueError, TypeError):
                    d = 1.5
        return (
            w if w is not None and w > 0 else 1.5,
            h if h is not None and h > 0 else 1.5,
            d if d is not None and d > 0 else 1.5,
        )


class CreationUpdateRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    prompt: Optional[str] = Field(default=None, max_length=2000)
    object_type: Optional[str] = None
    shape: Optional[str] = None
    color: Optional[str] = Field(default=None, min_length=1, max_length=50)
    width: Optional[float] = None
    height: Optional[float] = None
    depth: Optional[float] = None
    dimensions: Optional[dict[str, Any]] = None
    creation_data: Optional[str] = None


# =====================================================
# AUTHENTICATION CONFIGURATION
# =====================================================

DATABASE_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "polygen.db"
)

SECRET_KEY = os.getenv(
    "POLYGEN_SECRET_KEY",
    "polygen-development-secret-change-before-deployment"
)

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

security = HTTPBearer(auto_error=False)


# =====================================================
# DATABASE CONNECTION
# =====================================================

@contextmanager
def get_db():
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row

    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def init_database():
    with get_db() as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)
        connection.execute("""
            CREATE TABLE IF NOT EXISTS creations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                prompt TEXT DEFAULT '',
                object_type TEXT NOT NULL,
                color TEXT NOT NULL,
                width REAL NOT NULL,
                height REAL NOT NULL,
                depth REAL NOT NULL,
                creation_data TEXT DEFAULT '{}',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
        """)
        connection.execute("""
            CREATE INDEX IF NOT EXISTS idx_creations_user_id ON creations (user_id)
        """)


init_database()


# =====================================================
# PASSWORD HASHING
# =====================================================

def hash_password(password: str):

    salt = secrets.token_hex(16)

    hashed = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        600000
    ).hex()

    return f"{salt}${hashed}"


def verify_password(password: str, stored_hash: str):

    try:
        salt, original_hash = stored_hash.split("$")

        new_hash = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt.encode("utf-8"),
            600000
        ).hex()

        return hmac.compare_digest(
            new_hash,
            original_hash
        )

    except (ValueError, TypeError):
        return False


# =====================================================
# JWT TOKEN GENERATION
# =====================================================

def create_access_token(user_id: int, email: str):

    expiry = datetime.now(timezone.utc) + timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )

    payload = {
        "sub": str(user_id),
        "email": email,
        "exp": int(expiry.timestamp())
    }

    return jwt.encode(
        payload,
        SECRET_KEY,
        algorithm=ALGORITHM
    )


# =====================================================
# SIGNUP API
# =====================================================

@app.post("/api/auth/signup")
def signup(request: SignupRequest):

    email = request.email.strip().lower()

    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise HTTPException(
            status_code=400,
            detail="Please enter a valid email."
        )

    password_hash = hash_password(request.password)

    try:
        with get_db() as connection:

            cursor = connection.execute(
                """
                INSERT INTO users (email, password_hash, created_at)
                VALUES (?, ?, ?)
                """,
                (
                    email,
                    password_hash,
                    datetime.now(timezone.utc).isoformat()
                )
            )

            user_id = cursor.lastrowid

    except sqlite3.IntegrityError:
        raise HTTPException(
            status_code=409,
            detail="This email is already registered."
        )

    token = create_access_token(user_id, email)

    return {
        "success": True,
        "message": "Account created successfully.",
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user_id,
            "email": email
        }
    }


# =====================================================
# LOGIN API
# =====================================================

@app.post("/api/auth/login")
def login(request: LoginRequest):

    email = request.email.strip().lower()

    with get_db() as connection:

        user = connection.execute(
            "SELECT * FROM users WHERE email = ?",
            (email,)
        ).fetchone()

    if user is None or not verify_password(
        request.password,
        user["password_hash"]
    ):
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password."
        )

    token = create_access_token(
        user["id"],
        user["email"]
    )

    return {
        "success": True,
        "message": "Login successful.",
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "email": user["email"]
        }
    }


# =====================================================
# GET CURRENT USER - JWT VERIFICATION
# =====================================================

def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
):

    token = None

    if credentials is not None and credentials.credentials:
        token = credentials.credentials
    else:
        auth_header = (
            request.headers.get("Authorization")
            or request.headers.get("authorization")
        )
        if auth_header:
            token = auth_header

    if not token:
        raise HTTPException(
            status_code=401,
            detail="Please login first."
        )

    # Sanitize token: remove whitespace, accidental surrounding quotes, and redundant 'Bearer ' prefixes
    token = token.strip()

    while token.lower().startswith("bearer "):
        token = token[7:].strip()

    if (
        (token.startswith('"') and token.endswith('"'))
        or (token.startswith("'") and token.endswith("'"))
    ):
        token = token[1:-1].strip()

    if not token:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token. Please login again."
        )

    try:

        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM],
            options={"leeway": 60}
        )

        sub = payload.get("sub")
        if sub is None:
            raise HTTPException(
                status_code=401,
                detail="Invalid token data."
            )

        user_id = int(sub)

        with get_db() as connection:

            user = connection.execute(
                """
                SELECT id, email, created_at
                FROM users
                WHERE id = ?
                """,
                (user_id,)
            ).fetchone()

        if user is None:

            raise HTTPException(
                status_code=401,
                detail="User not found."
            )

        return dict(user)

    except HTTPException:
        raise

    except JWTError as error:

        print(f"[AUTH DIAGNOSTIC] JWT verification failed: {type(error).__name__} ({str(error)})")

        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token. Please login again."
        )

    except (ValueError, TypeError, KeyError) as error:

        print(f"[AUTH DIAGNOSTIC] JWT payload validation failed: {type(error).__name__}")

        raise HTTPException(
            status_code=401,
            detail="Invalid token data."
        )


# =====================================================
# USER PROFILE API
# =====================================================

@app.get("/api/auth/me")
def get_profile(
    current_user: dict = Depends(get_current_user)
):

    return {
        "success": True,
        "user": current_user
    }


# =====================================================
# CLOUD CREATIONS API
# =====================================================

def format_creation(row: sqlite3.Row) -> dict:
    w = float(row["width"])
    h = float(row["height"])
    d = float(row["depth"])
    return {
        "id": row["id"],
        "user_id": row["user_id"],
        "name": row["name"],
        "prompt": row["prompt"] or "",
        "object_type": row["object_type"],
        "shape": row["object_type"],
        "color": row["color"],
        "width": w,
        "height": h,
        "depth": d,
        "dimensions": {
            "width": f"{w:.2f}",
            "height": f"{h:.2f}",
            "depth": f"{d:.2f}",
        },
        "creation_data": row["creation_data"] or "{}",
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


@app.post("/api/creations", status_code=201)
def create_creation(
    request: CreationCreateRequest,
    current_user: dict = Depends(get_current_user)
):
    name = request.name.strip()
    if not name:
        raise HTTPException(
            status_code=400,
            detail="Creation name cannot be empty."
        )

    object_type = request.get_object_type()
    if object_type not in ("cube", "sphere", "cylinder", "cone", "torus"):
        raise HTTPException(
            status_code=400,
            detail="Invalid object type. Must be cube, sphere, cylinder, cone, or torus."
        )

    width, height, depth = request.get_dimensions()
    now_iso = datetime.now(timezone.utc).isoformat()

    with get_db() as connection:
        cursor = connection.execute(
            """
            INSERT INTO creations (
                user_id, name, prompt, object_type, color,
                width, height, depth, creation_data, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                current_user["id"],
                name,
                request.prompt or "",
                object_type,
                request.color,
                width,
                height,
                depth,
                request.creation_data or "{}",
                now_iso,
                now_iso,
            )
        )
        creation_id = cursor.lastrowid
        saved_row = connection.execute(
            "SELECT * FROM creations WHERE id = ?",
            (creation_id,)
        ).fetchone()

    return {
        "success": True,
        "message": "Creation saved successfully to cloud.",
        "creation": format_creation(saved_row)
    }


@app.get("/api/creations")
def get_user_creations(
    current_user: dict = Depends(get_current_user)
):
    with get_db() as connection:
        rows = connection.execute(
            """
            SELECT * FROM creations
            WHERE user_id = ?
            ORDER BY updated_at DESC, id DESC
            """,
            (current_user["id"],)
        ).fetchall()

    return {
        "success": True,
        "count": len(rows),
        "creations": [format_creation(row) for row in rows]
    }


@app.get("/api/creations/{creation_id}")
def get_creation_by_id(
    creation_id: int,
    current_user: dict = Depends(get_current_user)
):
    with get_db() as connection:
        row = connection.execute(
            """
            SELECT * FROM creations
            WHERE id = ? AND user_id = ?
            """,
            (creation_id, current_user["id"])
        ).fetchone()

    if row is None:
        raise HTTPException(
            status_code=404,
            detail="Creation not found."
        )

    return {
        "success": True,
        "creation": format_creation(row)
    }


@app.put("/api/creations/{creation_id}")
def update_creation(
    creation_id: int,
    request: CreationUpdateRequest,
    current_user: dict = Depends(get_current_user)
):
    with get_db() as connection:
        existing = connection.execute(
            """
            SELECT * FROM creations
            WHERE id = ? AND user_id = ?
            """,
            (creation_id, current_user["id"])
        ).fetchone()

        if existing is None:
            raise HTTPException(
                status_code=404,
                detail="Creation not found."
            )

        name = request.name.strip() if request.name is not None else existing["name"]
        if not name:
            raise HTTPException(
                status_code=400,
                detail="Creation name cannot be empty."
            )

        prompt = request.prompt if request.prompt is not None else existing["prompt"]

        object_type = request.object_type or request.shape
        if object_type is not None:
            object_type = object_type.lower().strip()
            if object_type not in ("cube", "sphere", "cylinder", "cone", "torus"):
                raise HTTPException(
                    status_code=400,
                    detail="Invalid object type. Must be cube, sphere, cylinder, cone, or torus."
                )
        else:
            object_type = existing["object_type"]

        color = request.color if request.color is not None else existing["color"]

        w = request.width
        h = request.height
        d = request.depth
        if request.dimensions:
            if w is None and "width" in request.dimensions:
                try:
                    w = float(request.dimensions["width"])
                except (ValueError, TypeError):
                    pass
            if h is None and "height" in request.dimensions:
                try:
                    h = float(request.dimensions["height"])
                except (ValueError, TypeError):
                    pass
            if d is None and "depth" in request.dimensions:
                try:
                    d = float(request.dimensions["depth"])
                except (ValueError, TypeError):
                    pass

        width = w if (w is not None and w > 0) else existing["width"]
        height = h if (h is not None and h > 0) else existing["height"]
        depth = d if (d is not None and d > 0) else existing["depth"]

        creation_data = (
            request.creation_data
            if request.creation_data is not None
            else existing["creation_data"]
        )
        now_iso = datetime.now(timezone.utc).isoformat()

        connection.execute(
            """
            UPDATE creations
            SET name = ?, prompt = ?, object_type = ?, color = ?,
                width = ?, height = ?, depth = ?, creation_data = ?, updated_at = ?
            WHERE id = ? AND user_id = ?
            """,
            (
                name,
                prompt,
                object_type,
                color,
                width,
                height,
                depth,
                creation_data,
                now_iso,
                creation_id,
                current_user["id"],
            )
        )

        updated_row = connection.execute(
            "SELECT * FROM creations WHERE id = ?",
            (creation_id,)
        ).fetchone()

    return {
        "success": True,
        "message": "Creation updated successfully.",
        "creation": format_creation(updated_row)
    }


@app.delete("/api/creations/{creation_id}")
def delete_creation(
    creation_id: int,
    current_user: dict = Depends(get_current_user)
):
    with get_db() as connection:
        existing = connection.execute(
            "SELECT id FROM creations WHERE id = ? AND user_id = ?",
            (creation_id, current_user["id"])
        ).fetchone()

        if existing is None:
            raise HTTPException(
                status_code=404,
                detail="Creation not found."
            )

        connection.execute(
            "DELETE FROM creations WHERE id = ? AND user_id = ?",
            (creation_id, current_user["id"])
        )

    return {
        "success": True,
        "message": "Creation deleted successfully."
    }


# =====================================================
# NLP PROMPT PROCESSING
# =====================================================

def normalize_prompt(value: str) -> str:

    value = unicodedata.normalize(
        "NFC",
        value.lower()
    )

    value = re.sub(
        r"""[.,!?;:()[\]{}"'،؛؟–—-]""",
        " ",
        value
    )

    return re.sub(r"\s+", " ", value).strip()


def contains(words: set[str], aliases: tuple[str, ...]):

    return any(alias in words for alias in aliases)


SHAPE_ALIASES = {

    "sphere": (
        "sphere", "spherical", "ball", "orb",
        "football", "basketball", "globe",
        "gola", "gend", "golaakar",
        "गोला", "गोल", "गेंद", "गोलाकार"
    ),

    "cylinder": (
        "cylinder", "cylindrical", "pipe", "tube", "roll",
        "belan", "nal", "बेलन", "नली", "पाइप"
    ),

    "cone": (
        "cone", "conical", "funnel", "icecream",
        "waffle", "shanku", "शंकु"
    ),

    "torus": (
        "torus", "ring", "donut", "doughnut",
        "ring-shaped", "chhalla", "छल्ला"
    ),

    "cube": (
        "cube", "cubic", "box", "cuboid", "block",
        "box-shaped", "ghan", "dabba",
        "डिब्बा", "डब्बा", "घन", "घनाकार"
    ),

}


BASE_DIMENSIONS = {

    "cube": (1.50, 1.50, 1.50),
    "sphere": (1.80, 1.80, 1.80),
    "cylinder": (1.50, 1.50, 1.50),
    "cone": (1.70, 1.70, 1.70),
    "torus": (2.16, 2.16, 0.56),

}


COLOR_ALIASES = {

    "#FF0000": ("red", "laal", "लाल"),
    "#0000FF": ("blue", "neela", "nila", "नीला", "नीली"),
    "#008000": ("green", "hara", "हरा", "हरी"),
    "#FFFF00": ("yellow", "peela", "पीला", "पीली"),
    "#FFA500": ("orange", "narangi", "नारंगी"),
    "#800080": ("purple", "baingani", "jamuni", "बैंगनी", "जामुनी"),
    "#000000": ("black", "kala", "काला", "काली"),
    "#FFFFFF": ("white", "safed", "सफेद"),

}


def analyse_prompt(prompt: str):

    normalized = normalize_prompt(prompt)
    words = set(normalized.split())

    shape = next(
        (
            name
            for name, aliases in SHAPE_ALIASES.items()
            if contains(words, aliases)
        ),
        None,
    )

    if shape is None:
        return None

    width, height, depth = BASE_DIMENSIONS[shape]

    if contains(words, (
        "small", "tiny", "little", "chhota", "chhoti",
        "chhote", "छोटा", "छोटी", "छोटे", "नन्हा", "नन्ही"
    )):

        width *= 0.65
        height *= 0.65
        depth *= 0.65

    elif contains(words, (
        "large", "big", "huge", "bada", "badi",
        "bade", "बड़ा", "बड़ी", "बड़े", "विशाल"
    )):

        width *= 1.5
        height *= 1.5
        depth *= 1.5

    if contains(words, (
        "tall", "long", "lamba", "lambi",
        "ऊँचा", "ऊंचा", "लंबा", "लम्बा", "लंबी", "लम्बी"
    )):

        height *= 1.4

    elif contains(words, (
        "short", "chhota", "chhoti", "नाटा", "छोटा"
    )):

        height *= 0.75

    if contains(words, (
        "wide", "broad", "chauda", "chaudi",
        "चौड़ा", "चौड़ी", "चौड़ी"
    )):

        width *= 1.35

    elif contains(words, (
        "narrow", "patla", "patli", "पतला", "पतली"
    )):

        width *= 0.75

    if contains(words, (
        "thick", "thicker", "mota", "moti", "मोटा", "मोटी"
    )):

        depth *= 1.4

    elif contains(words, (
        "thin", "thinner", "patla", "patli", "पतला", "पतली"
    )):

        depth *= 0.6

    limit = lambda number: min(10.0, max(0.1, number))

    dimensions = {

        "width": f"{limit(width):.2f}",
        "height": f"{limit(height):.2f}",
        "depth": f"{limit(depth):.2f}",

    }

    color = None

    for hex_color, aliases in COLOR_ALIASES.items():

        if contains(words, aliases):

            color = hex_color
            break

    return {
        "shape": shape,
        "color": color,
        "dimensions": dimensions
    }


# =====================================================
# HOME API
# =====================================================

@app.get("/")
def home():

    return {
        "message": "Welcome to PolyGen API!",
        "status": "Backend is running",
    }


# =====================================================
# HEALTH CHECK API
# =====================================================

@app.get("/health")
def health_check():

    return {
        "status": "healthy",
        "project": "PolyGen"
    }


# =====================================================
# TEXT-TO-3D PROMPT API
# =====================================================

@app.post("/api/prompt")
def analyze_prompt(request: PromptRequest):

    prompt = request.prompt.strip()

    if not prompt:

        return {
            "success": False,
            "message": "Prompt cannot be empty."
        }

    result = analyse_prompt(prompt)

    if result is None:

        return {
            "success": False,
            "message": "Shape not recognised. Try cube, sphere, cylinder, cone or torus.",
        }

    return {
        "success": True,
        "received_prompt": prompt,
        **result,
        "message": "Prompt analysed successfully by PolyGen backend.",
    }


# =====================================================
# IMAGE VALIDATION API
# =====================================================

@app.post("/api/image/validate")
def validate_image(request: ImageValidationRequest):

    """Validate an uploaded image payload; this does not reconstruct a 3D model."""

    allowed_types = {

        "image/png": (b"\x89PNG\r\n\x1a\n",),
        "image/jpeg": (b"\xff\xd8\xff",),
        "image/webp": (b"RIFF",),

    }

    if request.content_type not in allowed_types:

        return {
            "success": False,
            "message": "Unsupported image type. Use PNG, JPG or WebP.",
        }

    try:

        image_bytes = base64.b64decode(
            request.image_base64,
            validate=True
        )

    except (binascii.Error, ValueError):

        return {
            "success": False,
            "message": "The uploaded image data is invalid."
        }

    if not image_bytes:

        return {
            "success": False,
            "message": "The uploaded image is empty."
        }

    if len(image_bytes) > 8 * 1024 * 1024:

        return {
            "success": False,
            "message": "Image is too large. Maximum size is 8 MB."
        }

    if not any(
        image_bytes.startswith(signature)
        for signature in allowed_types[request.content_type]
    ):

        return {
            "success": False,
            "message": "The file content does not match its selected image type.",
        }

    if (
        request.content_type == "image/webp"
        and image_bytes[8:12] != b"WEBP"
    ):

        return {
            "success": False,
            "message": "The uploaded WebP image is invalid.",
        }

    safe_filename = (
        request.filename.replace("\\", "/").split("/")[-1]
    )

    return {
        "success": True,
        "filename": safe_filename,
        "content_type": request.content_type,
        "size_bytes": len(image_bytes),
        "message": "Image received and validated by PolyGen backend.",
    }
