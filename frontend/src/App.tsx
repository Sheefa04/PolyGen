
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import './App.css';

function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);

  const [color, setColor] = useState('#8b5cf6');
  const [prompt, setPrompt] = useState('');
  const [message, setMessage] = useState(
    'Your first procedural object is ready.'
  );

  // Create the first procedural 3D object
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#111827');

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );

    camera.position.set(3, 2.4, 4);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true
    });

    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, 2)
    );

    renderer.setSize(
      container.clientWidth,
      container.clientHeight
    );

    container.appendChild(renderer.domElement);

    // Procedural cube geometry
    const geometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);

    const material = new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.5,
      metalness: 0.2
    });

    const cube = new THREE.Mesh(geometry, material);
    scene.add(cube);
    meshRef.current = cube;

    // Lighting
    const ambientLight = new THREE.AmbientLight(
      0xffffff,
      1.5
    );
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(
      0xffffff,
      2
    );
    directionalLight.position.set(3, 5, 4);
    scene.add(directionalLight);

    // Ground grid
    const grid = new THREE.GridHelper(10, 10, 0x475569, 0x334155);
    grid.position.y = -1.1;
    scene.add(grid);

    // Animation
    let animationId = 0;

    const animate = () => {
      animationId = requestAnimationFrame(animate);

      cube.rotation.y += 0.006;
      cube.rotation.x += 0.002;

      renderer.render(scene, camera);
    };

    animate();

    // Responsive viewer
    const handleResize = () => {
      if (!container) return;

      camera.aspect =
        container.clientWidth / container.clientHeight;

      camera.updateProjectionMatrix();

      renderer.setSize(
        container.clientWidth,
        container.clientHeight
      );
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);

      geometry.dispose();
      material.dispose();
      renderer.dispose();

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

  // Capture the user's prompt
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!prompt.trim()) {
      setMessage('Please enter a prompt first.');
      return;
    }

    setMessage(
      `Prompt received: "${prompt}". Prompt-based generation is our next development milestone.`
    );
  };

  return (
    <div className="app">

      <aside className="sidebar">
        <h2 className="logo">Poly<span>Gen</span></h2>

        <p className="side-label">WORKSPACE</p>

        <div className="nav-item active">◈ Dashboard</div>
        <div className="nav-item">▧ My Assets</div>
        <div className="nav-item">◷ History</div>

        <div className="sidebar-bottom">
          <p>PolyGen Prototype</p>
          <small>Version 0.1.0</small>
        </div>
      </aside>

      <main className="main">

        <header className="topbar">
          <div>
            <h2>3D Creation Studio</h2>
            <p>Turn your ideas into 3D assets.</p>
          </div>

          <span className="status">● Prototype Mode</span>
        </header>

        <section className="content">

          <div className="prompt-card">
            <h3>Describe your 3D object</h3>

            <p>
              Enter an idea that you want to create.
            </p>

            <form onSubmit={handleSubmit}>
              <textarea
                value={prompt}
                onChange={(event) =>
                  setPrompt(event.target.value)
                }
                placeholder="Example: Create a futuristic sports car..."
              />

              <button type="submit">
                Preview Prompt →
              </button>
            </form>

            <p className="message">{message}</p>
          </div>

          <div className="workspace">

            <div className="viewer-heading">
              <div>
                <h3>3D Viewport</h3>
                <p>First procedural 3D asset</p>
              </div>

              <span className="object-tag">Cube · 3D</span>
            </div>

            <div className="viewer" ref={mountRef} />

            <div className="customization">
              <div>
                <h3>Customize Object</h3>
                <p>Change your object's appearance.</p>
              </div>

              <label className="color-control">
                Object Color
                <input
                  type="color"
                  value={color}
                  onChange={(event) =>
                    setColor(event.target.value)
                  }
                />
              </label>
            </div>

          </div>

        </section>

        <footer>
          PolyGen © 2026 · Generative Text-to-3D Asset Pipeline
        </footer>

      </main>
    </div>
  );
}

export default App;
