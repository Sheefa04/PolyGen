
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="PolyGen API",
    description="AI-powered Text-to-3D and Image-to-3D Asset Generation",
    version="1.0.0"
)

# Allow frontend to communicate with backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {
        "message": "Welcome to PolyGen API!",
        "status": "Backend is running"
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "project": "PolyGen"
    }


from pydantic import BaseModel


class PromptRequest(BaseModel):
    prompt: str


@app.post("/api/prompt")
def analyze_prompt(request: PromptRequest):
    prompt = request.prompt.strip()

    if not prompt:
        return {
            "success": False,
            "message": "Prompt cannot be empty."
        }

    return {
        "success": True,
        "received_prompt": prompt,
        "message": "PolyGen received your prompt successfully!"
    }