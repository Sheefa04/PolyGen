import { useEffect, useRef, useState, type FormEvent } from 'react';

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

} from 'lucide-react';

import './App.css';



type Dimensions = {

  width: string;

  height: string;

  depth: string;

};



type ShapeType = 'cube' | 'sphere' | 'cylinder' | 'cone' | 'torus';



type SavedCreation = {

  id: number;

  name: string;

  shape: ShapeType;

  color: string;

  dimensions: Dimensions;

  prompt: string;

};


function baseDimensionsForShape(shape: ShapeType): Dimensions {
  switch (shape) {
    case 'sphere': return { width: '1.80', height: '1.80', depth: '1.80' };
    case 'cylinder': return { width: '1.50', height: '1.50', depth: '1.50' };
    case 'cone': return { width: '1.70', height: '1.70', depth: '1.70' };
    case 'torus': return { width: '2.16', height: '2.16', depth: '0.56' };
    case 'cube':
    default: return { width: '1.50', height: '1.50', depth: '1.50' };
  }
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

  const [activeView, setActiveView] = useState<'studio' | 'creations'>('studio');



  const [dimensions, setDimensions] = useState<Dimensions>({

    width: '1.50',

    height: '1.50',

    depth: '1.50',

  });



  const [message, setMessage] = useState('Your creative space is ready.');
  // Load saved creations from browser storage.
  const [savedCreations, setSavedCreations] = useState<SavedCreation[]>(() => {

    try {

      const stored = localStorage.getItem('polygen-creations');

      return stored ? (JSON.parse(stored) as SavedCreation[]) : [];

    } catch {

      return [];

    }

  });
  // Save creations whenever the collection changes.
  useEffect(() => {

    try {

      localStorage.setItem(

        'polygen-creations',

        JSON.stringify(savedCreations)

      );

    } catch {

      setMessage('Unable to save creations in browser storage.');

    }

  }, [savedCreations]);
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
  // The Studio view can be hidden while My Creations is open.  // Wait until it becomes visible before resizing the renderer.
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
    setDimensions((previous) => ({ ...previous, [key]: String(Math.min(10, Math.max(0.1, numericValue))) }));
  };

  // Generate a procedural object from the prompt.
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {

    event.preventDefault();



    if (!prompt.trim()) {

      setMessage('Enter an idea to preview your creation.');

      return;

    }



    const text = prompt.trim().toLowerCase();



    let shape: ShapeType;



    if (text.includes('sphere') || text.includes('ball')) {

      shape = 'sphere';

    } else if (text.includes('cylinder')) {

      shape = 'cylinder';

    } else if (text.includes('cone')) {

      shape = 'cone';

    } else if (text.includes('torus') || text.includes('ring')) {

      shape = 'torus';

    } else if (text.includes('cube') || text.includes('box')) {

      shape = 'cube';

    } else {

      setMessage(

        'Try a supported shape: cube, sphere, cylinder, cone or torus.'

      );

      return;

    }



    const currentMesh = meshRef.current;



    if (!currentMesh) {

      setMessage('3D viewer is not ready. Please try again.');

      return;

    }



    currentMesh.geometry.dispose();

    currentMesh.geometry = createGeometry(shape);

    currentMesh.scale.set(1, 1, 1);

    currentMesh.rotation.set(0, 0, 0);



    setCurrentShape(shape);

    setObjectName(`Procedural ${shape}`);

    setDimensions(getDimensions(shape));



    setMessage(`Procedural ${shape} preview created successfully!`);

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

  // Save the current object.
  const saveCreation = () => {

    const creation: SavedCreation = {

      id: Date.now(),

      name: objectName,

      shape: currentShape,

      color,

      dimensions,

      prompt,

    };



    setSavedCreations((previous) => [...previous, creation]);

    setMessage('Creation saved successfully!');

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



    setObjectName(creation.name);

    setCurrentShape(creation.shape);

    setDimensions(creation.dimensions);

    setColor(creation.color);

    setPrompt(creation.prompt);



    setMessage('Saved creation reopened successfully!');

    setActiveView('studio');

  };
  // Delete a saved object.
  const deleteCreation = (id: number) => {

    setSavedCreations((previous) =>

      previous.filter((creation) => creation.id !== id)

    );



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

            className={`nav-item ${

              activeView === 'studio' ? 'active' : ''

            }`}

            onClick={() => setActiveView('studio')}

          >

            <PanelsTopLeft size={18} strokeWidth={1.8} />

            Studio

          </button>



          <button

            type="button"

            className={`nav-item ${

              activeView === 'creations' ? 'active' : ''

            }`}

            onClick={() => setActiveView('creations')}

          >

            <Layers3 size={18} strokeWidth={1.8} />

            My creations

            <span style={{ marginLeft: 'auto', fontSize: '12px' }}>

              {savedCreations.length}

            </span>

          </button>



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

              <span className="status-dot" />

              Local workspace

            </span>

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

                  >

                    <FolderOpen size={15} />

                    Save creation

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

                  placeholder="Try: Create a sphere, cylinder, cone, torus or cube..."

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

                  <strong>{objectName}</strong>

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

            <div style={{ marginBottom: '25px' }}>

              <p className="eyebrow">YOUR WORKSPACE / LIBRARY</p>



              <h2 style={{ fontSize: '28px', margin: '8px 0' }}>

                My creations

              </h2>



              <p style={{ color: '#68716B' }}>

                Your saved 3D objects, all in one place.

              </p>

            </div>



            {savedCreations.length === 0 ? (

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

                  Create a 3D object in Studio and save it here.

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



                    <p style={{ color: '#68716B', fontSize: '13px' }}>

                      {creation.shape.toUpperCase()} · {creation.color}

                    </p>



                    <div

                      style={{

                        display: 'flex',

                        gap: '8px',

                        marginTop: '16px',

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



        <footer className="studio-footer">

          <span>POLYGEN © 2026</span>

          <span>GENERATIVE TEXT-TO-3D ASSET PIPELINE</span>

        </footer>

      </main>

    </div>

  );

}



export default App;