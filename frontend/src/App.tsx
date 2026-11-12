
import { useEffect, useRef, useState, type FormEvent } from 'react';
import * as THREE from 'three';
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
} from 'lucide-react';
import './App.css';

function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);

  const [color, setColor] = useState('#8EAA9B');
  const [prompt, setPrompt] = useState('');
  const [message, setMessage] = useState(
    'Your creative space is ready.'
  );

  // Create the 3D scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#F7F7F3');

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );

    camera.position.set(3, 2.4, 4);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
    });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(renderer.domElement);

    // Main procedural object
    const geometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);

    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.45,
      metalness: 0.12,
    });

    const cube = new THREE.Mesh(geometry, material);
    cube.castShadow = true;
    cube.receiveShadow = true;
    scene.add(cube);
    meshRef.current = cube;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 2);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 3);
    mainLight.position.set(4, 6, 5);
    mainLight.castShadow = true;
    scene.add(mainLight);

    const softLight = new THREE.DirectionalLight(0xffffff, 1);
    softLight.position.set(-4, 2, -3);
    scene.add(softLight);

    // Subtle studio grid
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

    // Animation
    let animationId = 0;

    const animate = () => {
      animationId = requestAnimationFrame(animate);

      cube.rotation.y += 0.005;
      cube.rotation.x += 0.001;

      renderer.render(scene, camera);
    };

    animate();

    // Responsive viewport
    const resizeObserver = new ResizeObserver(() => {
      if (!container.clientWidth || !container.clientHeight) return;

      camera.aspect =
        container.clientWidth / container.clientHeight;

      camera.updateProjectionMatrix();

      renderer.setSize(
        container.clientWidth,
        container.clientHeight
      );
    });

    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(animationId);
      resizeObserver.disconnect();

      geometry.dispose();
      material.dispose();
      renderer.dispose();

      gridMaterials.forEach((item) => item.dispose());

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }

      meshRef.current = null;
    };
  }, []);

  // Update object colour
  useEffect(() => {
    const material = meshRef.current?.material;

    if (material instanceof THREE.MeshStandardMaterial) {
      material.color.set(color);
    }
  }, [color]);

  // Handle idea submission
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!prompt.trim()) {
      setMessage('Enter an idea to preview your creation.');
      return;
    }

    setMessage(
      `Idea saved for the next generation step: "${prompt.trim()}"`
    );
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

          <button type="button" className="nav-item active">
            <PanelsTopLeft size={18} strokeWidth={1.8} />
            Studio
          </button>

          <button type="button" className="nav-item">
            <Layers3 size={18} strokeWidth={1.8} />
            My creations
          </button>

          <button type="button" className="nav-item">
            <Clock3 size={18} strokeWidth={1.8} />
            Recent projects
          </button>
        </div>

        <div className="sidebar-bottom">
          <div className="profile-mark">P</div>
          <div>
            <strong>PolyGen Workspace</strong>
            <small>Personal studio · v0.1</small>
          </div>
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

          <div className="header-actions">
            <span className="save-status">
              <span className="status-dot"></span>
              Local workspace
            </span>
          </div>
        </header>

        <section className="studio-layout">

          {/* Main canvas area */}
          <div className="canvas-column">

            <div className="canvas-card">

              <div className="canvas-toolbar">
                <div>
                  <p className="eyebrow">LIVE PREVIEW</p>
                  <h2>Untitled composition</h2>
                </div>

                <span className="object-tag">3D OBJECT / 01</span>
              </div>

              <div className="viewer" ref={mountRef}></div>

              <div className="canvas-footer">
                <span>Perspective view</span>
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
                  placeholder="Describe a shape, product or object you want to create..."
                />

                <div className="idea-submit-row">
                  <p>{message}</p>
                  <button type="submit" className="create-button">
                    Preview idea
                    <ArrowUpRight size={17} />
                  </button>
                </div>
              </form>

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
                <div>
                  <strong>Procedural cube</strong>
                  <small>Mesh · Basic geometry</small>
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

              <div className="dimension-row">
                <span>Width</span>
                <strong>1.50</strong>
              </div>

              <div className="dimension-row">
                <span>Height</span>
                <strong>1.50</strong>
              </div>

              <div className="dimension-row">
                <span>Depth</span>
                <strong>1.50</strong>
              </div>
            </div>

            <div className="inspector-note">
              <Sparkles size={17} />
              <p>
                More geometry and material controls will be added
                as the studio develops.
              </p>
            </div>

          </aside>

        </section>

        <footer className="studio-footer">
          <span>POLYGEN © 2026</span>
          <span>GENERATIVE TEXT-TO-3D ASSET PIPELINE</span>
        </footer>

      </main>
    </div>
  );
}

export default App;
