import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import {
  PanelsTopLeft,
  Layers3,
  Clock3,
  Box,
  Sparkles,
  ArrowUpRight,
  SlidersHorizontal,
  Palette,
  Ruler,
  RotateCcw,
  Trash2,
  FolderOpen,
  Download,
  User,
  LogIn,
  LogOut,
  ShieldCheck,
  X,
  Cloud,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import './App.css';

const API_BASE_URL = 'http://127.0.0.1:8000';

type Dimensions = {
  width: string;
  height: string;
  depth: string;
};

type ShapeType = 'cube' | 'sphere' | 'cylinder' | 'cone' | 'torus';

type ActiveView = 'studio' | 'creations' | 'profile';

type AuthUser = {
  id: number;
  email: string;
  created_at?: string;
};

type SavedCreation = {
  id: number;
  user_id?: number;
  name: string;
  shape: ShapeType;
  object_type?: string;
  color: string;
  dimensions: Dimensions;
  prompt: string;
  creation_data?: string;
  created_at?: string;
  updated_at?: string;
};

function baseDimensionsForShape(shape: ShapeType): Dimensions {
  switch (shape) {
    case 'sphere':
      return { width: '1.80', height: '1.80', depth: '1.80' };
    case 'cylinder':
      return { width: '1.50', height: '1.50', depth: '1.50' };
    case 'cone':
      return { width: '1.70', height: '1.70', depth: '1.70' };
    case 'torus':
      return { width: '2.16', height: '2.16', depth: '0.56' };
    case 'cube':
    default:
      return { width: '1.50', height: '1.50', depth: '1.50' };
  }
}

// Convert English, Hindi and Hinglish prompts into easy-to-match words.
// NFC normalization keeps Hindi characters in a consistent Unicode form.
function normalizePrompt(value: string): string {
  return value
    .toLocaleLowerCase()
    .normalize('NFC')
    .replace(/[.,!?;:()[\]{}"'،؛؟]/g, ' ')
    .replace(/[–—-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Match complete words so a short word does not accidentally match
// an unrelated word that happens to contain the same letters.
function promptHasAny(words: Set<string>, terms: string[]): boolean {
  return terms.some((term) => words.has(term));
}

// Read size and proportion words from English, Hindi and Hinglish prompts.
function getPromptDimensions(
  shape: ShapeType,
  words: Set<string>,
  startingDimensions?: Dimensions
): Dimensions {
  const base = startingDimensions ?? baseDimensionsForShape(shape);
  let width = Number(base.width);
  let height = Number(base.height);
  let depth = Number(base.depth);

  // Overall object size.

  // Overall object size.
  if (
    promptHasAny(words, [
      'small', 'smaller', 'tiny', 'little', 'shrink',
      'chhota', 'chhoti', 'chhote',
      'छोटा', 'छोटी', 'छोटे', 'नन्हा', 'नन्ही',
    ])
  ) {
    width *= 0.65;
    height *= 0.65;
    depth *= 0.65;
  } else if (
    promptHasAny(words, [
      'large', 'larger', 'big', 'bigger', 'huge', 'increase',
      'bada', 'badi', 'bade',
      'बड़ा', 'बड़ी', 'बड़े', 'विशाल',
    ])
  ) {
    width *= 1.5;
    height *= 1.5;
    depth *= 1.5;
  }

  // Height / length.
  if (
    promptHasAny(words, [
      'tall', 'long', 'lamba', 'lambi', 'ऊँचा', 'ऊंचा',
      'लंबा', 'लम्बा', 'लंबी', 'लम्बी',
    ])
  ) {
    height *= 1.4;
  } else if (
    promptHasAny(words, [
      'short', 'chhota', 'chhoti', 'नाटा', 'छोटा',
    ])
  ) {
    height *= 0.75;
  }


  // Width.
  if (
    promptHasAny(words, [
      'wide', 'wider', 'widen',
      'broad', 'broader',
      'chauda', 'chaudi',
      'चौड़ा', 'चौड़ी', 'चौड़ी',
    ])
  ) {
    width *= 1.35;
  } else if (
    promptHasAny(words, [
      'narrow', 'narrower',
      'patla', 'patli', 'पतला', 'पतली',
    ])
  ) {
    width *= 0.75;
  }

  // Depth / thickness.
  if (
    promptHasAny(words, [
      'thick', 'thicker', 'mota', 'moti', 'मोटा', 'मोटी',
    ])
  ) {
    depth *= 1.4;
  } else if (
    promptHasAny(words, [
      'thin', 'thinner', 'patla', 'patli', 'पतला', 'पतली',
    ])
  ) {
    depth *= 0.6;
  }

  const limit = (value: number) => Math.min(10, Math.max(0.1, value));
  return {
    width: limit(width).toFixed(2),
    height: limit(height).toFixed(2),
    depth: limit(depth).toFixed(2),
  };
}

function CreationThumbnail({ creation }: { creation: SavedCreation }) {
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = previewRef.current;
    if (!container) return;

    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(3, 2.2, 3.5);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';

    container.appendChild(renderer.domElement);

    let geometry: THREE.BufferGeometry;
    switch (creation.shape) {
      case 'sphere':
        geometry = new THREE.SphereGeometry(0.9, 40, 32);
        break;
      case 'cylinder':
        geometry = new THREE.CylinderGeometry(0.75, 0.75, 1.5, 40);
        break;
      case 'cone':
        geometry = new THREE.ConeGeometry(0.85, 1.7, 40);
        break;
      case 'torus':
        geometry = new THREE.TorusGeometry(0.8, 0.28, 20, 60);
        break;
      case 'cube':
      default:
        geometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
        break;
    }

    const material = new THREE.MeshStandardMaterial({
      color: creation.color,
      roughness: 0.42,
      metalness: 0.1,
    });

    const mesh = new THREE.Mesh(geometry, material);
    const base = baseDimensionsForShape(creation.shape);
    mesh.scale.set(
      Math.max(Number(creation.dimensions.width) / Number(base.width), 0.01),
      Math.max(Number(creation.dimensions.height) / Number(base.height), 0.01),
      Math.max(Number(creation.dimensions.depth) / Number(base.depth), 0.01)
    );
    mesh.rotation.set(-0.18, 0.55, 0);
    mesh.castShadow = true;

    scene.add(mesh);

    const ambientLight = new THREE.AmbientLight(0xffffff, 2.1);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.8);
    keyLight.position.set(4, 5, 5);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 1.1);
    fillLight.position.set(-4, 2, -3);
    scene.add(fillLight);

    const resizeObserver = new ResizeObserver(() => {
      const nextWidth = container.clientWidth;
      const nextHeight = container.clientHeight;
      if (!nextWidth || !nextHeight) return;

      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(nextWidth, nextHeight);
    });

    resizeObserver.observe(container);
    renderer.render(scene, camera);

    return () => {
      resizeObserver.disconnect();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [creation.shape, creation.color, creation.dimensions.width, creation.dimensions.height, creation.dimensions.depth]);

  return (
    <div
      ref={previewRef}
      aria-label={`${creation.shape} 3D preview`}
      style={{
        height: '130px',
        width: '100%',
        background: '#F7F7F3',
        borderRadius: '10px',
        overflow: 'hidden',
        marginBottom: '16px',
      }}
    />
  );
}

function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  const [color, setColor] = useState('#8EAA9B');
  const [prompt, setPrompt] = useState('');
  const [objectName, setObjectName] = useState('Procedural cube');
  const [currentShape, setCurrentShape] = useState<ShapeType>('cube');
  const [activeView, setActiveView] = useState<ActiveView>('studio');
  const [dimensions, setDimensions] = useState<Dimensions>({
    width: '1.50',
    height: '1.50',
    depth: '1.50',
  });
  const [message, setMessage] = useState('Your creative space is ready.');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageName, setImageName] = useState('');
  const [imageStatus, setImageStatus] = useState('Upload a PNG, JPG or WebP image (max 8 MB).');

  // Authentication state
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Validate stored JWT token on application startup
  useEffect(() => {
    const token = localStorage.getItem('polygen_token');
    if (!token) return;

    const verifyToken = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.user) {
            setUser(data.user);
          }
        } else if (response.status === 401) {
          localStorage.removeItem('polygen_token');
          setUser(null);
        }
      } catch (error) {
        console.warn('Backend server currently unavailable for initial auth check:', error);
      }
    };

    verifyToken();
  }, []);

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setAuthError(null);
    setAuthLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: authEmail.trim(),
          password: authPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setAuthError(data.detail || 'Incorrect email or password.');
        setAuthLoading(false);
        return;
      }

      if (data.access_token) {
        localStorage.setItem('polygen_token', data.access_token);
        setUser(data.user);
        setAuthModalOpen(false);
        setAuthPassword('');
        setAuthEmail('');
        setMessage(`Welcome back, ${data.user.email}!`);
      }
    } catch {
      setAuthError('Unable to connect to PolyGen backend. Please verify the server is running.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignup = async (event: FormEvent) => {
    event.preventDefault();
    setAuthError(null);

    if (authPassword.length < 8) {
      setAuthError('Password must contain at least 8 characters.');
      return;
    }

    if (authPassword !== authConfirmPassword) {
      setAuthError('Passwords do not match.');
      return;
    }

    setAuthLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: authEmail.trim(),
          password: authPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setAuthError(data.detail || 'Signup failed. Please try a different email address.');
        setAuthLoading(false);
        return;
      }

      if (data.access_token) {
        localStorage.setItem('polygen_token', data.access_token);
        setUser(data.user);
        setAuthModalOpen(false);
        setAuthPassword('');
        setAuthConfirmPassword('');
        setAuthEmail('');
        setMessage(`Account created! Welcome to PolyGen, ${data.user.email}!`);
      }
    } catch {
      setAuthError('Unable to connect to PolyGen backend. Please verify the server is running.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('polygen_token');
    setUser(null);
    if (activeView === 'profile') {
      setActiveView('studio');
    }
    setMessage('Logged out successfully.');
  };

  // Creations state
  const [selectedCreationId, setSelectedCreationId] = useState<number | null>(null);
  const [savedCreations, setSavedCreations] = useState<SavedCreation[]>(() => {
    try {
      const stored = localStorage.getItem('polygen-creations');
      return stored ? (JSON.parse(stored) as SavedCreation[]) : [];
    } catch {
      return [];
    }
  });
  const [creationsLoading, setCreationsLoading] = useState(false);
  const [creationsError, setCreationsError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Load creations from cloud when user is logged in
  const loadCreations = async (currentUser: AuthUser | null) => {
    if (!currentUser) return;
    const token = localStorage.getItem('polygen_token');
    if (!token) return;

    setCreationsLoading(true);
    setCreationsError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/creations`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (response.ok && data.success && Array.isArray(data.creations)) {
        setSavedCreations(data.creations);
      } else {
        setCreationsError(data.detail || 'Failed to load your cloud creations.');
      }
    } catch (err) {
      console.error('Network error loading cloud creations:', err);
      setCreationsError('Could not connect to PolyGen backend to load creations.');
    } finally {
      setCreationsLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem('polygen_token');
    if (!token) return;

    let ignore = false;
    // oxlint-disable-next-line react/set-state-in-effect
    setCreationsLoading(true);
    setCreationsError(null);

    fetch(`${API_BASE_URL}/api/creations`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        if (!ignore) {
          if (data.success && Array.isArray(data.creations)) {
            setSavedCreations(data.creations);
          } else {
            setCreationsError(data.detail || 'Failed to load your cloud creations.');
          }
        }
      })
      .catch((err) => {
        if (!ignore) {
          console.error('Network error loading cloud creations:', err);
          setCreationsError('Could not connect to PolyGen backend to load creations.');
        }
      })
      .finally(() => {
        if (!ignore) {
          setCreationsLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [user]);

  // Persist guest creations to localStorage only when user is NOT logged in
  useEffect(() => {
    if (!user) {
      try {
        localStorage.setItem(
          'polygen-creations',
          JSON.stringify(savedCreations)
        );
      } catch (error) {
        console.error('Unable to save creations in browser storage:', error);
      }
    }
  }, [savedCreations, user]);

  // Create geometry for each supported shape.
  const createGeometry = (shape: ShapeType): THREE.BufferGeometry => {
    switch (shape) {
      case 'sphere':
        return new THREE.SphereGeometry(0.9, 40, 32);
      case 'cylinder':
        return new THREE.CylinderGeometry(0.75, 0.75, 1.5, 40);
      case 'cone':
        return new THREE.ConeGeometry(0.85, 1.7, 40);
      case 'torus':
        return new THREE.TorusGeometry(0.8, 0.28, 20, 60);
      case 'cube':
      default:
        return new THREE.BoxGeometry(1.5, 1.5, 1.5);
    }
  };

  // Get dimensions for each shape.
  const getDimensions = (shape: ShapeType): Dimensions => {
    switch (shape) {
      case 'sphere':
        return { width: '1.80', height: '1.80', depth: '1.80' };
      case 'cylinder':
        return { width: '1.50', height: '1.50', depth: '1.50' };
      case 'cone':
        return { width: '1.70', height: '1.70', depth: '1.70' };
      case 'torus':
        return { width: '2.16', height: '2.16', depth: '0.56' };
      case 'cube':
      default:
        return { width: '1.50', height: '1.50', depth: '1.50' };
    }
  };

  // Reset camera and object rotation.
  const resetCamera = () => {
    if (!cameraRef.current) return;
    cameraRef.current.position.set(3, 2.4, 4);
    cameraRef.current.lookAt(0, 0, 0);

    if (meshRef.current) {
      meshRef.current.rotation.set(0, 0, 0);
    }
  };

  // Create and manage the Three.js scene.
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#F7F7F3');

    const camera = new THREE.PerspectiveCamera(
      45,
      Math.max(container.clientWidth, 1) /
      Math.max(container.clientHeight, 1),
      0.1,
      100
    );
    camera.position.set(3, 2.4, 4);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(
      Math.max(container.clientWidth, 1),
      Math.max(container.clientHeight, 1)
    );
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(renderer.domElement);

    // Initial cube.
    const material = new THREE.MeshStandardMaterial({
      color: '#8EAA9B',
      roughness: 0.45,
      metalness: 0.12,
    });

    const object = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 1.5, 1.5),
      material
    );
    object.castShadow = true;
    object.receiveShadow = true;
    scene.add(object);
    meshRef.current = object;

    // Mouse and touch rotation.
    let isDragging = false;
    let previousX = 0;
    let previousY = 0;

    const canvas = renderer.domElement;

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      isDragging = true;
      previousX = event.clientX;
      previousY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!isDragging) return;
      const deltaX = event.clientX - previousX;
      const deltaY = event.clientY - previousY;
      object.rotation.y += deltaX * 0.01;
      object.rotation.x += deltaY * 0.01;
      previousX = event.clientX;
      previousY = event.clientY;
    };

    const handlePointerUp = () => {
      isDragging = false;
    };

    // Zoom using mouse wheel.
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const distance = camera.position.length();
      const nextDistance = THREE.MathUtils.clamp(
        distance + event.deltaY * 0.005,
        2.5,
        9
      );
      camera.position.setLength(nextDistance);
    };

    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('pointercancel', handlePointerUp);
    canvas.addEventListener('wheel', handleWheel, { passive: false });

    // Lighting.
    const ambientLight = new THREE.AmbientLight(0xffffff, 2);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 3);
    mainLight.position.set(4, 6, 5);
    mainLight.castShadow = true;
    scene.add(mainLight);

    const softLight = new THREE.DirectionalLight(0xffffff, 1);
    softLight.position.set(-4, 2, -3);
    scene.add(softLight);

    // Studio grid.
    const grid = new THREE.GridHelper(
      10,
      20,
      0xB9C5BD,
      0xE2E6E1
    );
    grid.position.y = -1.1;
    const gridMaterials = Array.isArray(grid.material)
      ? grid.material
      : [grid.material];
    gridMaterials.forEach((item) => {
      item.transparent = true;
      item.opacity = 0.45;
    });
    scene.add(grid);

    // Animation loop.
    let animationId = 0;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    // Resize the renderer when its container changes size.
    const resizeObserver = new ResizeObserver(() => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (!width || !height) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    });
    resizeObserver.observe(container);

    // Cleanup.
    return () => {
      cancelAnimationFrame(animationId);
      resizeObserver.disconnect();
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerup', handlePointerUp);
      canvas.removeEventListener('pointercancel', handlePointerUp);
      canvas.removeEventListener('wheel', handleWheel);
      object.geometry.dispose();
      material.dispose();
      gridMaterials.forEach((item) => item.dispose());
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      meshRef.current = null;
      cameraRef.current = null;
    };
  }, []);

  // Update the selected object's colour.
  useEffect(() => {
    const material = meshRef.current?.material;
    if (material instanceof THREE.MeshStandardMaterial) {
      material.color.set(color);
    }
  }, [color]);

  // Apply editable dimensions to the active 3D object.
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const base = getDimensions(currentShape);
    mesh.scale.set(
      Math.max(Number(dimensions.width) / Number(base.width), 0.01),
      Math.max(Number(dimensions.height) / Number(base.height), 0.01),
      Math.max(Number(dimensions.depth) / Number(base.depth), 0.01)
    );
  }, [dimensions, currentShape]);

  const updateDimension = (key: keyof Dimensions, value: string) => {
    if (value === '') {
      setDimensions((previous) => ({ ...previous, [key]: value }));
      return;
    }
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return;
    setDimensions((previous) => ({
      ...previous,
      [key]: String(Math.min(10, Math.max(0.1, numericValue))),
    }));
  };

  // Validate an uploaded image with the FastAPI backend and show its preview.
  const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setImageStatus('Unsupported image type. Please choose PNG, JPG or WebP.');
      event.target.value = '';
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setImageStatus('Image is too large. Please choose a file smaller than 8 MB.');
      event.target.value = '';
      return;
    }

    setImageStatus('Checking image with PolyGen backend...');
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === 'string'
          ? resolve(reader.result)
          : reject(new Error('Could not read the selected image.'));
        reader.onerror = () => reject(new Error('Could not read the selected image.'));
        reader.readAsDataURL(file);
      });

      const base64Image = dataUrl.split(',')[1];
      const response = await fetch('http://127.0.0.1:8000/api/image/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          content_type: file.type,
          image_base64: base64Image,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'The backend could not validate this image.');
      }

      setImagePreview(dataUrl);
      setImageName(file.name);
      setImageStatus(`Image verified by backend · ${(result.size_bytes / 1024).toFixed(1)} KB`);
    } catch (error) {
      console.error('Image upload error:', error);
      setImageStatus(error instanceof Error ? error.message : 'Image upload failed.');
    } finally {
      event.target.value = '';
    }
  };


  // Generate a basic image-based 3D prototype.
  // This maps the uploaded image onto a sphere.
  const handleGenerateImageModel = () => {
    if (!imagePreview) {
      setImageStatus('Please upload an image first.');
      return;
    }

    const currentMesh = meshRef.current;

    if (!currentMesh) {
      setImageStatus('3D viewer is not ready.');
      return;
    }

    const loader = new THREE.TextureLoader();

    loader.load(
      imagePreview,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 8;

        // Replace current geometry with a sphere.
        currentMesh.geometry.dispose();
        currentMesh.geometry = new THREE.SphereGeometry(
          0.9,
          64,
          48
        );

        currentMesh.scale.set(1, 1, 1);
        currentMesh.rotation.set(0, 0, 0);

        // Apply uploaded image as sphere texture.
        const material = currentMesh.material;

        if (material instanceof THREE.MeshStandardMaterial) {
          if (material.map) {
            material.map.dispose();
          }

          material.map = texture;
          material.color.set('#FFFFFF');
          material.roughness = 0.62;
          material.metalness = 0.02;
          material.needsUpdate = true;
        }

        const newDimensions = {
          width: '1.80',
          height: '1.80',
          depth: '1.80'
        };

        setCurrentShape('sphere');
        setDimensions(newDimensions);
        setColor('#FFFFFF');

        setObjectName('Image-based 3D prototype');
        setSelectedCreationId(null);
        setPrompt(`Image prototype: ${imageName}`);

        setMessage(
          'Image-based 3D prototype generated successfully!'
        );

        setImageStatus(
          '3D prototype generated from uploaded image.'
        );
      },
      undefined,
      (error) => {
        console.error('Image texture error:', error);

        setImageStatus(
          'Unable to generate prototype. Try another image.'
        );
      }
    );
  };


  // Generate a procedural object from the prompt.
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!prompt.trim()) {
      setMessage('Enter an idea to preview your creation.');
      return;
    }

    const normalizedText = normalizePrompt(prompt);
    const promptWords = new Set(normalizedText.split(' '));

    // A modifier-only prompt should update the currently displayed object.
    // Examples: "Narrow", "Patla", "पतला", "Tall", "Chhota".
    const containsShapeWord = promptHasAny(promptWords, [
      'sphere', 'ball', 'football', 'basketball', 'globe', 'gola', 'gend', 'गोला', 'गोल', 'गेंद',
      'cylinder', 'pipe', 'tube', 'belan', 'बेलन',
      'cone', 'funnel', 'shanku', 'शंकु',
      'torus', 'ring', 'donut', 'chhalla', 'छल्ला',
      'cube', 'box', 'cuboid', 'block', 'ghan', 'dabba', 'डिब्बा', 'डब्बा', 'घन',
    ]);

const containsDimensionWord = promptHasAny(promptWords, [
  'small', 'tiny', 'little', 'smaller', 'shrink',
  'chhota', 'chhoti', 'chhote', 'छोटा', 'छोटी', 'छोटे', 'नन्हा', 'नन्ही',

  'large', 'big', 'huge', 'larger', 'bigger', 'increase',
  'bada', 'badi', 'bade', 'बड़ा', 'बड़ी', 'बड़े', 'विशाल',

  'tall', 'taller', 'long', 'longer',
  'lamba', 'lambi', 'ऊँचा', 'ऊंचा', 'लंबा', 'लम्बा', 'लंबी', 'लम्बी',

  'short', 'shorter', 'नाटा',

  'wide', 'wider', 'widen', 'broad', 'broader',
  'chauda', 'chaudi', 'चौड़ा', 'चौड़ी', 'चौड़ी',

  'narrow', 'narrower', 'patla', 'patli', 'पतला', 'पतली',

  'thick', 'thicker', 'thicken', 'mota', 'moti', 'मोटा', 'मोटी',

  'thin', 'thinner', 'पतला', 'पतली',
]);

    const containsColorWord = promptHasAny(promptWords, [
      'red', 'laal', 'लाल',
      'blue', 'neela', 'nila', 'नीला', 'नीली',
      'green', 'hara', 'हरा', 'हरी',
      'yellow', 'peela', 'पीला', 'पीली',
      'orange', 'narangi', 'नारंगी',
      'purple', 'baingani', 'jamuni', 'बैंगनी', 'जामुनी',
      'black', 'kala', 'काला', 'काली',
      'white', 'safed', 'सफेद',
    ]);

    const isModifierOnlyPrompt =
      !containsShapeWord && (containsDimensionWord || containsColorWord);

    // Full prompts are analysed by FastAPI. Modifier-only prompts stay local
    // because they modify the object that is already visible in the viewer.
    let backendAnalysis: {
      shape: ShapeType;
      color: string | null;
      dimensions: Dimensions;
    } | null = null;

    if (!isModifierOnlyPrompt) {
      try {
        const response = await fetch('http://127.0.0.1:8000/api/prompt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: prompt.trim() }),
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
          setMessage(data.message || 'The backend could not understand this prompt.');
          return;
        }

        if (
          !['cube', 'sphere', 'cylinder', 'cone', 'torus'].includes(data.shape) ||
          (data.color !== null && typeof data.color !== 'string') ||
          !data.dimensions ||
          !['width', 'height', 'depth'].every((key) =>
            Number.isFinite(Number(data.dimensions[key]))
          )
        ) {
          throw new Error('Backend returned an invalid object description.');
        }

        backendAnalysis = {
          shape: data.shape as ShapeType,
          color: data.color,
          dimensions: {
            width: Number(data.dimensions.width).toFixed(2),
            height: Number(data.dimensions.height).toFixed(2),
            depth: Number(data.dimensions.depth).toFixed(2),
          },
        };
        console.log('PolyGen Backend Analysis:', data);
      } catch (error) {
        console.error('Backend connection error:', error);
        setMessage('Unable to connect to PolyGen backend. Check that FastAPI is running.');
        return;
      }
    }

    // The backend identifies the shape for full prompts. Modifier-only
    // prompts keep the shape that is already visible in the viewer.
    const shape: ShapeType = backendAnalysis?.shape ?? currentShape;

    const currentMesh = meshRef.current;
    if (!currentMesh) {
      setMessage('3D viewer is not ready. Please try again.');
      return;
    }

    // The backend's colour is authoritative for full prompts. Local colour
    // matching is retained for modifier-only updates.
    let detectedColor = backendAnalysis?.color ?? color;
    if (!backendAnalysis) {
      if (promptHasAny(promptWords, ['red', 'laal', 'लाल'])) {
        detectedColor = '#FF0000';
      } else if (promptHasAny(promptWords, ['blue', 'neela', 'nila', 'नीला', 'नीली'])) {
        detectedColor = '#0000FF';
      } else if (promptHasAny(promptWords, ['green', 'hara', 'हरा', 'हरी'])) {
        detectedColor = '#008000';
      } else if (promptHasAny(promptWords, ['yellow', 'peela', 'पीला', 'पीली'])) {
        detectedColor = '#FFFF00';
      } else if (promptHasAny(promptWords, ['orange', 'narangi', 'नारंगी'])) {
        detectedColor = '#FFA500';
      } else if (
        promptHasAny(promptWords, [
          'purple', 'baingani', 'jamuni', 'बैंगनी', 'जामुनी',
        ])
      ) {
        detectedColor = '#800080';
      } else if (promptHasAny(promptWords, ['black', 'kala', 'काला', 'काली'])) {
        detectedColor = '#000000';
      } else if (promptHasAny(promptWords, ['white', 'safed', 'सफेद'])) {
        detectedColor = '#FFFFFF';
      }
    }
    setColor(detectedColor);

    // Generate the selected 3D geometry.
    currentMesh.geometry.dispose();
    currentMesh.geometry = createGeometry(shape);
    currentMesh.scale.set(1, 1, 1);
    currentMesh.rotation.set(0, 0, 0);
    if (currentMesh.material instanceof THREE.MeshStandardMaterial) {
      currentMesh.material.color.set(detectedColor);
    }

    // Apply size and proportion words such as large, small, tall and wide.
    const newShapeDimensions = backendAnalysis?.dimensions ?? getPromptDimensions(
      shape,
      promptWords,
      isModifierOnlyPrompt ? dimensions : undefined
    );
    const newObjectName = `Procedural ${shape}`;
    setSelectedCreationId(null);
    setCurrentShape(shape);
    setObjectName(newObjectName);
    setDimensions(newShapeDimensions);
    setMessage(
      isModifierOnlyPrompt
        ? `Updated the current ${shape} dimensions! Click "Save creation" to save.`
        : `Procedural ${shape} preview created! Click "Save creation" to save to My Creations.`
    );
  };

  // Export a Three.js object as a binary GLB file.
  const downloadGLB = (mesh: THREE.Mesh, fileName: string) => {
    const exportScene = new THREE.Scene();
    const exportMesh = mesh.clone();
    exportMesh.geometry = mesh.geometry.clone();

    if (Array.isArray(mesh.material)) {
      exportMesh.material = mesh.material.map((material) => material.clone());
    } else {
      exportMesh.material = mesh.material.clone();
    }

    exportScene.add(exportMesh);

    const exporter = new GLTFExporter();
    exporter.parse(
      exportScene,
      (result) => {
        if (!(result instanceof ArrayBuffer)) {
          setMessage('Unable to export this model as a GLB file.');
          exportMesh.geometry.dispose();
          return;
        }

        const blob = new Blob([result], { type: 'model/gltf-binary' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${fileName.trim().replace(/[^a-z0-9-_]+/gi, '-') || 'polygen-model'}.glb`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        setMessage('3D model exported successfully!');
        exportMesh.geometry.dispose();
        if (Array.isArray(exportMesh.material)) {
          exportMesh.material.forEach((material) => material.dispose());
        } else {
          exportMesh.material.dispose();
        }
      },
      (error) => {
        console.error('GLB export failed:', error);
        setMessage('GLB export failed. Please try again.');
        exportMesh.geometry.dispose();
      },
      { binary: true }
    );
  };

  // Export the object currently visible in Studio.
  const exportCurrentCreation = () => {
    const currentMesh = meshRef.current;
    if (!currentMesh) {
      setMessage('3D viewer is not ready. Please try again.');
      return;
    }
    downloadGLB(currentMesh, objectName);
  };

  // Export a saved object directly from its stored shape and colour.
  const exportSavedCreation = (creation: SavedCreation) => {
    const exportMesh = new THREE.Mesh(
      createGeometry(creation.shape),
      new THREE.MeshStandardMaterial({
        color: creation.color,
        roughness: 0.45,
        metalness: 0.12,
      })
    );

    const base = baseDimensionsForShape(creation.shape);
    exportMesh.scale.set(
      Math.max(Number(creation.dimensions.width) / Number(base.width), 0.01),
      Math.max(Number(creation.dimensions.height) / Number(base.height), 0.01),
      Math.max(Number(creation.dimensions.depth) / Number(base.depth), 0.01)
    );

    downloadGLB(exportMesh, creation.name);
    exportMesh.geometry.dispose();
    (exportMesh.material as THREE.Material).dispose();
  };

  // Add a new creation or update the creation currently open in Studio.
  const saveCreation = async () => {
    const trimmedName = objectName.trim();
    if (!trimmedName) {
      setMessage('Please enter a name before saving your creation.');
      return;
    }

    const token = localStorage.getItem('polygen_token');

    // Cloud storage flow when user is authenticated
    if (user && token) {
      setIsSaving(true);
      try {
        const isExisting =
          selectedCreationId !== null &&
          savedCreations.some((item) => item.id === selectedCreationId);

        if (isExisting) {
          // Update existing creation via PUT /api/creations/{id}
          const response = await fetch(`${API_BASE_URL}/api/creations/${selectedCreationId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              name: trimmedName,
              shape: currentShape,
              color,
              dimensions,
              prompt: prompt.trim(),
            }),
          });

          const data = await response.json();
          if (!response.ok || !data.success) {
            setMessage(data.detail || 'Could not update creation on cloud.');
            return;
          }

          const updated = data.creation;
          setSavedCreations((previous) =>
            previous.map((item) => (item.id === selectedCreationId ? updated : item))
          );
          setMessage(`"${trimmedName}" updated in cloud storage successfully!`);
        } else {
          // Create new creation via POST /api/creations
          const response = await fetch(`${API_BASE_URL}/api/creations`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              name: trimmedName,
              shape: currentShape,
              color,
              dimensions,
              prompt: prompt.trim(),
            }),
          });

          const data = await response.json();
          if (!response.ok || !data.success) {
            setMessage(data.detail || 'Could not save creation to cloud.');
            return;
          }

          const newCreation = data.creation;
          setSavedCreations((previous) => [newCreation, ...previous]);
          setSelectedCreationId(newCreation.id);
          setMessage(`"${trimmedName}" saved to cloud storage successfully!`);
        }
      } catch (err) {
        console.error('Error saving to cloud:', err);
        setMessage('Network error: Unable to reach PolyGen cloud backend.');
      } finally {
        setIsSaving(false);
      }
      return;
    }

    // Guest fallback (local storage)
    const isExistingCreation =
      selectedCreationId !== null &&
      savedCreations.some((item) => item.id === selectedCreationId);

    if (isExistingCreation) {
      const updatedCreation: SavedCreation = {
        id: selectedCreationId,
        name: trimmedName,
        shape: currentShape,
        color,
        dimensions: { ...dimensions },
        prompt,
      };

      setSavedCreations((previous) =>
        previous.map((item) =>
          item.id === selectedCreationId ? updatedCreation : item
        )
      );
      setMessage('Saved locally. Sign in to sync your creations to the cloud!');
    } else {
      let creationId = Date.now();
      while (savedCreations.some((item) => item.id === creationId)) {
        creationId += 1;
      }

      const newCreation: SavedCreation = {
        id: creationId,
        name: trimmedName,
        shape: currentShape,
        color,
        dimensions: { ...dimensions },
        prompt,
      };

      setSavedCreations((previous) => [...previous, newCreation]);
      setSelectedCreationId(creationId);
      setMessage('Saved locally. Sign in to sync your creations to the cloud!');
    }
  };

  // Reopen a saved object in the Studio.
  const openCreation = (creation: SavedCreation) => {
    const currentMesh = meshRef.current;
    if (!currentMesh) {
      setMessage('3D viewer is not ready. Please try again.');
      return;
    }

    currentMesh.geometry.dispose();
    currentMesh.geometry = createGeometry(creation.shape);
    currentMesh.rotation.set(0, 0, 0);

    if (currentMesh.material instanceof THREE.MeshStandardMaterial) {
      currentMesh.material.color.set(creation.color);
    }

    const base = getDimensions(creation.shape);
    currentMesh.scale.set(
      Math.max(Number(creation.dimensions.width) / Number(base.width), 0.01),
      Math.max(Number(creation.dimensions.height) / Number(base.height), 0.01),
      Math.max(Number(creation.dimensions.depth) / Number(base.depth), 0.01)
    );

    setSelectedCreationId(creation.id);
    setObjectName(creation.name);
    setCurrentShape(creation.shape);
    setDimensions(creation.dimensions);
    setColor(creation.color);
    setPrompt(creation.prompt);
    setMessage('Saved creation reopened successfully!');
    setActiveView('studio');
  };

  // Delete a saved object.
  const deleteCreation = async (id: number) => {
    const token = localStorage.getItem('polygen_token');

    if (user && token) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/creations/${id}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json();
        if (!response.ok) {
          setMessage(data.detail || 'Could not delete creation from cloud.');
          return;
        }

        setSavedCreations((previous) => previous.filter((item) => item.id !== id));
        if (selectedCreationId === id) {
          setSelectedCreationId(null);
        }
        setMessage('Creation deleted from cloud.');
      } catch (err) {
        console.error('Error deleting creation:', err);
        setMessage('Network error: Could not delete creation.');
      }
      return;
    }

    // Guest delete
    setSavedCreations((previous) =>
      previous.filter((creation) => creation.id !== id)
    );
    if (selectedCreationId === id) {
      setSelectedCreationId(null);
    }
    setMessage('Creation deleted.');
  };

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="brand">
          polygen<span>.</span>
          <small>CREATIVE STUDIO</small>
        </div>

        <div className="sidebar-section">
          <p className="side-label">WORKSPACE</p>

          <button
            type="button"
            className={`nav-item ${activeView === 'studio' ? 'active' : ''
              }`}
            onClick={() => setActiveView('studio')}
          >
            <PanelsTopLeft size={18} strokeWidth={1.8} />
            Studio
          </button>

          <button
            type="button"
            className={`nav-item ${activeView === 'creations' ? 'active' : ''
              }`}
            onClick={() => setActiveView('creations')}
          >
            <Layers3 size={18} strokeWidth={1.8} />
            My creations
            <span style={{ marginLeft: 'auto', fontSize: '12px' }}>
              {savedCreations.length}
            </span>
          </button>

          {user && (
            <button
              type="button"
              className={`nav-item ${activeView === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveView('profile')}
            >
              <User size={18} strokeWidth={1.8} />
              User profile
            </button>
          )}

          <button
            type="button"
            className="nav-item"
            onClick={() =>
              setMessage('Recent projects will be available soon.')
            }
          >
            <Clock3 size={18} strokeWidth={1.8} />
            Recent projects
          </button>
        </div>

        <div className="sidebar-bottom">
          <div
            className="profile-mark"
            style={{
              background: user ? '#D7E5DC' : '#E5ECE6',
              color: '#252B27',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {user ? user.email.charAt(0).toUpperCase() : 'P'}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <strong
              style={{
                display: 'block',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: '12px',
              }}
              title={user ? user.email : 'PolyGen Guest'}
            >
              {user ? user.email : 'PolyGen Guest'}
            </strong>
            <small style={{ color: user ? '#587363' : '#68716B' }}>
              {user ? 'Verified User · v0.1' : 'Personal studio · v0.1'}
            </small>
          </div>
          {user ? (
            <button
              type="button"
              onClick={handleLogout}
              title="Logout"
              aria-label="Logout"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#68716B',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <LogOut size={16} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setAuthMode('login');
                setAuthError(null);
                setAuthModalOpen(true);
              }}
              title="Log in"
              aria-label="Log in"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#587363',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <LogIn size={16} />
            </button>
          )}
        </div>
      </aside>

      {/* Main workspace */}
      <main className="studio-main">
        <header className="studio-header">
          <div>
            <p className="eyebrow">YOUR CREATIVE WORKSPACE / 001</p>
            <h1>
              Make something <span>different.</span>
            </h1>
            <p className="header-description">
              Shape your ideas into interactive 3D creations.
            </p>
          </div>

          <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="save-status">
              <span className="status-dot" />
              Local workspace
            </span>

            {user ? (
              <>
                <div className="user-badge" title={`Signed in as ${user.email}`}>
                  <User size={13} color="#587363" />
                  <span>{user.email}</span>
                </div>
                <button
                  type="button"
                  className={`auth-action-btn ${activeView === 'profile' ? 'primary' : ''}`}
                  onClick={() => setActiveView(activeView === 'profile' ? 'studio' : 'profile')}
                >
                  <ShieldCheck size={14} />
                  Profile
                </button>
                <button
                  type="button"
                  className="auth-action-btn"
                  onClick={handleLogout}
                  title="Sign out of PolyGen"
                >
                  <LogOut size={14} />
                  Logout
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="auth-action-btn"
                  onClick={() => {
                    setAuthMode('login');
                    setAuthError(null);
                    setAuthModalOpen(true);
                  }}
                >
                  <LogIn size={14} />
                  Log in
                </button>
                <button
                  type="button"
                  className="auth-action-btn primary"
                  onClick={() => {
                    setAuthMode('signup');
                    setAuthError(null);
                    setAuthModalOpen(true);
                  }}
                >
                  Sign up
                </button>
              </>
            )}
          </div>
        </header>

        {/* Studio stays mounted so the Three.js canvas is not destroyed. */}
        <section
          className="studio-layout"
          style={{
            display: activeView === 'studio' ? 'grid' : 'none',
          }}
        >
          <div className="canvas-column">
            <div className="canvas-card">
              <div className="canvas-toolbar">
                <div>
                  <p className="eyebrow">LIVE PREVIEW</p>
                  <h2>{objectName}</h2>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <span className="object-tag">3D OBJECT / 01</span>

                  <button
                    type="button"
                    onClick={saveCreation}
                    className="create-button"
                    disabled={isSaving}
                  >
                    <FolderOpen size={15} />
                    {isSaving
                      ? 'Saving...'
                      : selectedCreationId !== null
                        ? 'Save changes'
                        : 'Save creation'}
                  </button>

                  <button
                    type="button"
                    onClick={exportCurrentCreation}
                    className="create-button"
                    title="Download current model as GLB"
                  >
                    <Download size={15} />
                    Export GLB
                  </button>
                </div>
              </div>

              <div className="viewer" ref={mountRef}>
                <button
                  type="button"
                  className="reset-camera"
                  onClick={resetCamera}
                >
                  <RotateCcw size={13} />
                  Reset view
                </button>
              </div>

              <div className="canvas-footer">
                <span>Drag to rotate · Scroll to zoom</span>
                <span>Interactive preview</span>
              </div>
            </div>

            {/* Idea console */}
            <div className="idea-card">
              <div className="idea-heading">
                <div>
                  <p className="eyebrow">IDEA TO OBJECT</p>
                  <h2>What are you imagining?</h2>
                </div>
                <span className="idea-number">01 — 03</span>
              </div>

              <form onSubmit={handleSubmit}>
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="Try: Create a red sphere / laal gola / नीला घन / green cylinder..."
                />

                <div className="idea-submit-row">
                  <p>{message}</p>
                  <button type="submit" className="create-button">
                    Preview idea
                    <ArrowUpRight size={17} />
                  </button>
                </div>
              </form>

              <div style={{ marginTop: '22px', paddingTop: '18px', borderTop: '1px solid #E2E6E1' }}>
                <p className="eyebrow">IMAGE TO 3D / PREPARATION</p>
                <h3 style={{ margin: '6px 0 12px', fontSize: '16px' }}>Upload a reference image</h3>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleImageUpload}
                  aria-label="Upload a reference image"
                />
                <p style={{ color: '#68716B', fontSize: '12px', margin: '9px 0' }}>{imageStatus}</p>
                {imagePreview && (
                  <div style={{ marginTop: '12px' }}>
                    <img
                      src={imagePreview}
                      alt="Uploaded image preview"
                      style={{ display: 'block', maxWidth: '100%', maxHeight: '240px', objectFit: 'contain', borderRadius: '10px', border: '1px solid #E2E6E1', background: '#FFFFFF' }}
                    />
                    <p style={{ color: '#68716B', fontSize: '12px', marginTop: '7px' }}>{imageName}</p>


                    <button
                      type="button"
                      className="create-button"
                      onClick={handleGenerateImageModel}
                      style={{ marginTop: '10px' }}
                    >
                      <Sparkles size={15} />
                      Generate basic 3D prototype
                    </button>

                    <p
                      style={{
                        color: '#68716B',
                        fontSize: '11px',
                        lineHeight: 1.5,
                        marginTop: '8px'
                      }}
                    >
                      Creates a basic sphere with your uploaded image
                      applied as a texture. This is not full AI
                      object reconstruction.
                    </p>

                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Properties inspector */}
          <aside className="inspector">
            <div className="inspector-heading">
              <p className="eyebrow">OBJECT SETTINGS</p>
              <h2>
                <SlidersHorizontal size={19} strokeWidth={1.8} />
                Inspector
              </h2>
            </div>

            <div className="inspector-section">
              <p className="section-label">SELECTED OBJECT</p>
              <div className="selected-object">
                <div className="object-thumbnail">
                  <Box size={23} strokeWidth={1.6} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <input
                    type="text"
                    value={objectName}
                    onChange={(event) => setObjectName(event.target.value)}
                    placeholder="Creation name"
                    aria-label="Creation name"
                    style={{
                      width: '100%',
                      padding: '5px 8px',
                      border: '1px solid #E2E6E1',
                      borderRadius: '6px',
                      background: '#FFFFFF',
                      color: '#252B27',
                      fontSize: '12px',
                      fontWeight: 600,
                      fontFamily: 'inherit',
                      outline: 'none',
                    }}
                  />
                  <small style={{ display: 'block', marginTop: '4px', color: '#68716B', fontSize: '9px' }}>
                    Mesh · Basic geometry
                  </small>
                </div>
              </div>
            </div>

            <div className="inspector-section">
              <p className="section-label">
                <Palette size={14} />
                APPEARANCE
              </p>

              <label className="property-label">
                Object colour
                <input
                  type="color"
                  value={color}
                  onChange={(event) => setColor(event.target.value)}
                />
              </label>

              <div className="color-value">
                <span>Colour value</span>
                <strong>{color.toUpperCase()}</strong>
              </div>
            </div>

            <div className="inspector-section">
              <p className="section-label">
                <Ruler size={14} />
                DIMENSIONS
              </p>

              {(['width', 'height', 'depth'] as const).map((key) => (
                <label
                  className="dimension-row"
                  key={key}
                  style={{ alignItems: 'center', gap: '12px' }}
                >
                  <span style={{ textTransform: 'capitalize' }}>{key}</span>
                  <input
                    type="number"
                    min="0.1"
                    max="10"
                    step="0.1"
                    value={dimensions[key]}
                    onChange={(event) => updateDimension(key, event.target.value)}
                    onBlur={() => {
                      if (!dimensions[key] || Number(dimensions[key]) < 0.1) {
                        setDimensions((previous) => ({ ...previous, [key]: '0.1' }));
                      }
                    }}
                    aria-label={`${key} dimension`}
                    style={{
                      width: '86px',
                      padding: '7px 9px',
                      border: '1px solid #E2E6E1',
                      borderRadius: '7px',
                      background: '#FFFFFF',
                      color: '#252B27',
                      font: 'inherit',
                      textAlign: 'right',
                    }}
                  />
                </label>
              ))}
            </div>

            <div className="inspector-note">
              <Sparkles size={17} />
              <p>
                Adjust width, height and depth to resize your object.
                Values are saved and included in GLB exports.
              </p>
            </div>
          </aside>
        </section>

        {/* My Creations view */}
        {activeView === 'creations' && (
          <section style={{ padding: '30px 0' }}>
            <div
              style={{
                marginBottom: '25px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div>
                <p className="eyebrow">
                  {user ? 'CLOUD WORKSPACE / LIBRARY' : 'LOCAL WORKSPACE / LIBRARY'}
                </p>
                <h2 style={{ fontSize: '28px', margin: '8px 0' }}>
                  My creations
                </h2>
                <p style={{ color: '#68716B', margin: 0 }}>
                  {user
                    ? `Your cloud-stored 3D creations (${user.email}).`
                    : 'Your saved 3D objects in local browser storage.'}
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {user ? (
                  <>
                    <span className="cloud-badge" title="Creations synced to SQLite backend">
                      <Cloud size={14} />
                      Cloud Storage
                    </span>
                    <button
                      type="button"
                      className="auth-action-btn"
                      onClick={() => loadCreations(user)}
                      disabled={creationsLoading}
                      title="Reload creations from cloud"
                    >
                      <RefreshCw size={13} className={creationsLoading ? 'spin' : ''} />
                      {creationsLoading ? 'Syncing...' : 'Refresh'}
                    </button>
                  </>
                ) : (
                  <span
                    className="cloud-badge"
                    style={{ background: '#FFF7E6', borderColor: '#FFE2A8', color: '#8A5D00' }}
                  >
                    Local storage only
                  </span>
                )}
              </div>
            </div>

            {!user && (
              <div className="guest-banner">
                <div>
                  <strong style={{ display: 'block', color: '#5A4305', fontSize: '13px' }}>
                    Want cloud access across all devices?
                  </strong>
                  <p className="guest-banner-text">
                    Sign in or create an account to save and access your 3D creations securely from our cloud database.
                  </p>
                </div>
                <button
                  type="button"
                  className="auth-action-btn primary"
                  onClick={() => {
                    setAuthMode('login');
                    setAuthModalOpen(true);
                  }}
                >
                  <LogIn size={14} />
                  Sign in to sync
                </button>
              </div>
            )}

            {creationsLoading ? (
              <div className="creations-loading-box">
                <RefreshCw size={32} className="spin" color="#8EAA9B" style={{ margin: '0 auto 12px' }} />
                <h3 style={{ margin: '0 0 6px' }}>Loading your creations...</h3>
                <p style={{ color: '#68716B', fontSize: '13px', margin: 0 }}>
                  Retrieving your 3D assets from the PolyGen cloud database.
                </p>
              </div>
            ) : creationsError ? (
              <div className="creations-error-box">
                <AlertCircle size={32} color="#B02A37" style={{ margin: '0 auto 10px' }} />
                <h3 style={{ margin: '0 0 6px', color: '#B02A37' }}>Failed to load creations</h3>
                <p className="creations-error-message">{creationsError}</p>
                <button
                  type="button"
                  className="create-button"
                  onClick={() => loadCreations(user)}
                >
                  <RefreshCw size={14} />
                  Retry
                </button>
              </div>
            ) : savedCreations.length === 0 ? (
              <div
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E2E6E1',
                  borderRadius: '14px',
                  padding: '45px 20px',
                  textAlign: 'center',
                }}
              >
                <Box size={35} color="#8EAA9B" />
                <h3>No creations yet</h3>
                <p style={{ color: '#68716B' }}>
                  {user
                    ? 'Create a 3D object in Studio and click "Save creation" to store it in the cloud.'
                    : 'Create a 3D object in Studio and save it here.'}
                </p>
                <button
                  type="button"
                  className="create-button"
                  onClick={() => setActiveView('studio')}
                >
                  Go to Studio
                  <ArrowUpRight size={16} />
                </button>
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(auto-fill, minmax(230px, 1fr))',
                  gap: '18px',
                }}
              >
                {savedCreations.map((creation) => (
                  <div
                    key={creation.id}
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid #E2E6E1',
                      borderRadius: '14px',
                      padding: '20px',
                    }}
                  >
                    <CreationThumbnail creation={creation} />
                    <h3 style={{ margin: '0 0 6px' }}>
                      {creation.name}
                    </h3>
                    <p style={{ color: '#68716B', fontSize: '13px', margin: '0 0 6px' }}>
                      {creation.shape.toUpperCase()} · {creation.color}
                    </p>
                    {creation.created_at && (
                      <p style={{ color: '#8F9992', fontSize: '11px', margin: '0 0 12px' }}>
                        Saved {new Date(creation.created_at).toLocaleDateString()}
                      </p>
                    )}
                    <div
                      style={{
                        display: 'flex',
                        gap: '8px',
                        marginTop: creation.created_at ? '0' : '16px',
                      }}
                    >
                      <button
                        type="button"
                        className="create-button"
                        onClick={() => openCreation(creation)}
                      >
                        Open
                        <ArrowUpRight size={15} />
                      </button>

                      <button
                        type="button"
                        className="create-button"
                        onClick={() => exportSavedCreation(creation)}
                        title={`Export ${creation.name} as GLB`}
                      >
                        <Download size={15} />
                        Export
                      </button>

                      <button
                        type="button"
                        onClick={() => deleteCreation(creation.id)}
                        aria-label={`Delete ${creation.name}`}
                        style={{
                          border: '1px solid #E2E6E1',
                          borderRadius: '8px',
                          padding: '8px 12px',
                          background: '#FFFFFF',
                          cursor: 'pointer',
                          color: '#68716B',
                        }}
                      >
                        <Trash2 size={15} />
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* User Profile View */}
        {activeView === 'profile' && (
          <section style={{ padding: '30px 0' }}>
            <div style={{ marginBottom: '25px', textAlign: 'center' }}>
              <p className="eyebrow">ACCOUNT / SECURITY</p>
              <h2 style={{ fontSize: '28px', margin: '8px 0' }}>User Profile</h2>
              <p style={{ color: '#68716B' }}>Protected profile verified with JWT authentication.</p>
            </div>

            {user ? (
              <div className="profile-card">
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    marginBottom: '20px',
                    paddingBottom: '16px',
                    borderBottom: '1px solid var(--line)',
                  }}
                >
                  <div
                    style={{
                      width: '54px',
                      height: '54px',
                      borderRadius: '50%',
                      background: '#D7E5DC',
                      color: '#252B27',
                      fontSize: '22px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {user.email.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '18px' }}>{user.email}</h3>
                    <span style={{ fontSize: '12px', color: '#2E7D32', fontWeight: 600 }}>
                      ● Active session verified
                    </span>
                  </div>
                </div>

                <div className="profile-field">
                  <span className="profile-label">User ID</span>
                  <span className="profile-value">#{user.id}</span>
                </div>

                <div className="profile-field">
                  <span className="profile-label">Email Address</span>
                  <span className="profile-value">{user.email}</span>
                </div>

                <div className="profile-field">
                  <span className="profile-label">Authentication Method</span>
                  <span className="profile-value">PBKDF2-HMAC-SHA256 & HS256 JWT</span>
                </div>

                {user.created_at && (
                  <div className="profile-field">
                    <span className="profile-label">Member Since</span>
                    <span className="profile-value">
                      {new Date(user.created_at).toLocaleString()}
                    </span>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                  <button
                    type="button"
                    className="create-button"
                    onClick={() => setActiveView('studio')}
                    style={{ flex: 1 }}
                  >
                    Back to Studio
                  </button>
                  <button
                    type="button"
                    className="create-button"
                    onClick={handleLogout}
                    style={{ background: '#F1F4F1', color: '#252B27' }}
                  >
                    <LogOut size={15} />
                    Logout
                  </button>
                </div>
              </div>
            ) : (
              <div className="profile-card" style={{ textAlign: 'center' }}>
                <p>Please log in to view your protected user profile.</p>
                <button
                  type="button"
                  className="create-button"
                  onClick={() => {
                    setAuthMode('login');
                    setAuthError(null);
                    setAuthModalOpen(true);
                  }}
                  style={{ marginTop: '16px' }}
                >
                  <LogIn size={15} />
                  Sign In
                </button>
              </div>
            )}
          </section>
        )}

        <footer className="studio-footer">
          <span>POLYGEN © 2026</span>
          <span>GENERATIVE TEXT-TO-3D ASSET PIPELINE</span>
        </footer>
      </main>

      {/* Authentication Modal */}
      {authModalOpen && (
        <div
          className="auth-modal-backdrop"
          onClick={() => setAuthModalOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="auth-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="auth-modal-close"
              onClick={() => setAuthModalOpen(false)}
              aria-label="Close authentication modal"
            >
              <X size={18} />
            </button>

            <div className="auth-tabs">
              <button
                type="button"
                className={`auth-tab ${authMode === 'login' ? 'active' : ''}`}
                onClick={() => {
                  setAuthMode('login');
                  setAuthError(null);
                }}
              >
                Sign In
              </button>
              <button
                type="button"
                className={`auth-tab ${authMode === 'signup' ? 'active' : ''}`}
                onClick={() => {
                  setAuthMode('signup');
                  setAuthError(null);
                }}
              >
                Create Account
              </button>
            </div>

            {authError && <div className="auth-error">{authError}</div>}

            <form
              onSubmit={authMode === 'login' ? handleLogin : handleSignup}
              className="auth-form"
            >
              <label>
                Email address
                <input
                  type="email"
                  required
                  className="auth-input"
                  value={authEmail}
                  onChange={(event) => setAuthEmail(event.target.value)}
                  placeholder="you@example.com"
                  autoFocus
                />
              </label>

              <label>
                Password
                <input
                  type="password"
                  required
                  minLength={authMode === 'signup' ? 8 : 1}
                  className="auth-input"
                  value={authPassword}
                  onChange={(event) => setAuthPassword(event.target.value)}
                  placeholder={
                    authMode === 'signup'
                      ? 'At least 8 characters'
                      : 'Enter your password'
                  }
                />
              </label>

              {authMode === 'signup' && (
                <label>
                  Confirm Password
                  <input
                    type="password"
                    required
                    minLength={8}
                    className="auth-input"
                    value={authConfirmPassword}
                    onChange={(event) => setAuthConfirmPassword(event.target.value)}
                    placeholder="Confirm your password"
                  />
                </label>
              )}

              <button
                type="submit"
                className="auth-submit-btn"
                disabled={authLoading}
              >
                {authLoading ? (
                  'Processing...'
                ) : authMode === 'login' ? (
                  <>
                    <LogIn size={16} />
                    Sign In
                  </>
                ) : (
                  <>
                    <User size={16} />
                    Create Account
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
