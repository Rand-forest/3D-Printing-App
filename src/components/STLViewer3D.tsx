import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RotateCw, Eye, Maximize2, Layers, RefreshCw, ZoomIn, ZoomOut } from 'lucide-react';
import { ModelStats } from '../types';

interface STLViewer3DProps {
  geometry: THREE.BufferGeometry | null;
  stats?: ModelStats | null;
  colorHex?: string;
  wireframe?: boolean;
  onWireframeChange?: (val: boolean) => void;
  materialName?: string;
  heightClass?: string;
}

export const STLViewer3D: React.FC<STLViewer3DProps> = ({
  geometry,
  stats,
  colorHex = '#1e2022',
  wireframe = false,
  onWireframeChange,
  materialName = 'PLA+ Professional',
  heightClass = 'h-[440px]',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const boxHelperRef = useRef<THREE.BoxHelper | null>(null);

  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [showBoundingBox, setShowBoundingBox] = useState<boolean>(false);
  const [showGrid, setShowGrid] = useState<boolean>(true);

  // Interaction tracking refs
  const isDragging = useRef<boolean>(false);
  const previousMousePosition = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const sphericalRef = useRef<{ radius: number; theta: number; phi: number }>({
    radius: 180,
    theta: Math.PI / 4,
    phi: Math.PI / 3,
  });
  const targetLookAt = useRef<THREE.Vector3>(new THREE.Vector3(0, 20, 0));

  // Initialize Three.js scene once
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth || 500;
    const height = containerRef.current.clientHeight || 440;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0d1117');
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 2000);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    // Lighting setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight1.position.set(150, 250, 150);
    dirLight1.castShadow = true;
    dirLight1.shadow.mapSize.width = 1024;
    dirLight1.shadow.mapSize.height = 1024;
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x90cdf4, 0.6);
    dirLight2.position.set(-150, 100, -150);
    scene.add(dirLight2);

    const floorLight = new THREE.DirectionalLight(0xffedd5, 0.4);
    floorLight.position.set(0, -100, 0);
    scene.add(floorLight);

    // Build Plate (250 x 250 mm print bed)
    const gridHelper = new THREE.GridHelper(250, 25, 0x475569, 0x1e293b);
    gridHelper.position.y = 0;
    scene.add(gridHelper);

    // Bed plane for shadow reception
    const bedGeo = new THREE.PlaneGeometry(250, 250);
    const bedMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.9,
      metalness: 0.1,
    });
    const bedMesh = new THREE.Mesh(bedGeo, bedMat);
    bedMesh.rotation.x = -Math.PI / 2;
    bedMesh.position.y = -0.2;
    bedMesh.receiveShadow = true;
    scene.add(bedMesh);

    // Initial camera placement
    updateCamera();

    let animationFrameId: number;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      if (autoRotate && !isDragging.current) {
        sphericalRef.current.theta += 0.005;
        updateCamera();
      }

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };

    animate();

    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      renderer.dispose();
    };
  }, []);

  const updateCamera = () => {
    if (!cameraRef.current) return;
    const { radius, theta, phi } = sphericalRef.current;
    const x = radius * Math.sin(phi) * Math.sin(theta);
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.cos(theta);

    cameraRef.current.position.set(
      targetLookAt.current.x + x,
      targetLookAt.current.y + y,
      targetLookAt.current.z + z
    );
    cameraRef.current.lookAt(targetLookAt.current);
  };

  // Update Mesh when geometry, color, or wireframe change
  useEffect(() => {
    if (!sceneRef.current || !geometry) return;

    // Remove old mesh
    if (meshRef.current) {
      sceneRef.current.remove(meshRef.current);
      if (boxHelperRef.current) {
        sceneRef.current.remove(boxHelperRef.current);
      }
      meshRef.current.geometry.dispose();
      meshRef.current = null;
    }

    // Center geometry on bed
    geometry.computeBoundingBox();
    const bbox = geometry.boundingBox || new THREE.Box3();
    const center = new THREE.Vector3();
    bbox.getCenter(center);
    const size = new THREE.Vector3();
    bbox.getSize(size);

    // Reposition so bottom sits cleanly on Z=0 / Y=0 bed
    geometry.center();
    geometry.computeBoundingBox();
    const newBbox = geometry.boundingBox || new THREE.Box3();
    const minY = newBbox.min.y;
    geometry.translate(0, -minY, 0);

    // Realistic material based on selection
    const isResin = materialName.toLowerCase().includes('resin');
    const isCF = materialName.toLowerCase().includes('carbon');

    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(colorHex),
      roughness: isResin ? 0.2 : isCF ? 0.75 : 0.45,
      metalness: isResin ? 0.1 : 0.05,
      wireframe: wireframe,
      transparent: isResin,
      opacity: isResin ? 0.85 : 1.0,
      flatShading: false,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    sceneRef.current.add(mesh);
    meshRef.current = mesh;

    // Bounding box helper
    const boxHelper = new THREE.BoxHelper(mesh, 0x38bdf8);
    boxHelper.visible = showBoundingBox;
    sceneRef.current.add(boxHelper);
    boxHelperRef.current = boxHelper;

    // Set camera radius to comfortably fit model
    const maxDim = Math.max(size.x, size.y, size.z, 30);
    sphericalRef.current.radius = Math.max(120, maxDim * 2.2);
    targetLookAt.current.set(0, size.y / 2, 0);
    updateCamera();
  }, [geometry, colorHex, wireframe, materialName]);

  useEffect(() => {
    if (boxHelperRef.current) {
      boxHelperRef.current.visible = showBoundingBox;
    }
  }, [showBoundingBox]);

  // Mouse & Touch Controls
  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    previousMousePosition.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const deltaX = e.clientX - previousMousePosition.current.x;
    const deltaY = e.clientY - previousMousePosition.current.y;

    sphericalRef.current.theta -= deltaX * 0.008;
    sphericalRef.current.phi = Math.max(
      0.1,
      Math.min(Math.PI / 2 - 0.05, sphericalRef.current.phi - deltaY * 0.008)
    );

    previousMousePosition.current = { x: e.clientX, y: e.clientY };
    updateCamera();
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    sphericalRef.current.radius = Math.max(
      40,
      Math.min(800, sphericalRef.current.radius + e.deltaY * 0.3)
    );
    updateCamera();
  };

  const resetCamera = () => {
    sphericalRef.current.theta = Math.PI / 4;
    sphericalRef.current.phi = Math.PI / 3;
    sphericalRef.current.radius = 180;
    updateCamera();
  };

  const zoomIn = () => {
    sphericalRef.current.radius = Math.max(40, sphericalRef.current.radius * 0.85);
    updateCamera();
  };

  const zoomOut = () => {
    sphericalRef.current.radius = Math.min(800, sphericalRef.current.radius * 1.15);
    updateCamera();
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${heightClass} bg-slate-950 rounded-xl overflow-hidden select-none border border-slate-800 shadow-inner group`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      <canvas ref={canvasRef} className="w-full h-full cursor-grab active:cursor-grabbing block" />

      {/* Top Floating Controls */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto bg-slate-900/85 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700/60 shadow-lg text-xs font-mono text-slate-200">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>WebGL 3D Engine</span>
          {stats && (
            <span className="text-slate-400 border-l border-slate-700 pl-2">
              {stats.dimensionsMm.x} × {stats.dimensionsMm.y} × {stats.dimensionsMm.z} mm
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 pointer-events-auto bg-slate-900/85 backdrop-blur-md p-1 rounded-lg border border-slate-700/60 shadow-lg">
          <button
            type="button"
            id="stl-viewer-autorotate-btn"
            onClick={() => setAutoRotate(!autoRotate)}
            className={`p-1.5 rounded transition ${
              autoRotate
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Toggle Auto Rotation"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          <button
            type="button"
            id="stl-viewer-wireframe-btn"
            onClick={() => onWireframeChange && onWireframeChange(!wireframe)}
            className={`p-1.5 rounded transition ${
              wireframe
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Toggle Wireframe Mesh"
          >
            <Layers className="w-4 h-4" />
          </button>

          <button
            type="button"
            id="stl-viewer-bbox-btn"
            onClick={() => setShowBoundingBox(!showBoundingBox)}
            className={`p-1.5 rounded transition ${
              showBoundingBox
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Toggle Bounding Box"
          >
            <Eye className="w-4 h-4" />
          </button>

          <button
            type="button"
            id="stl-viewer-reset-btn"
            onClick={resetCamera}
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Reset View"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Bottom Floating Stats & Zoom Bar */}
      <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between pointer-events-none">
        {stats ? (
          <div className="pointer-events-auto bg-slate-900/90 backdrop-blur-md px-3 py-2 rounded-lg border border-slate-700/60 shadow-lg text-xs space-y-1">
            <div className="flex items-center gap-3 text-slate-300">
              <span>
                Volume:{' '}
                <strong className="text-emerald-400 font-semibold">{stats.volumeCm3} cm³</strong>
              </span>
              <span>•</span>
              <span>
                Weight: <strong className="text-indigo-300 font-semibold">{stats.estimatedGrams}g</strong>
              </span>
              <span>•</span>
              <span>
                Triangles: <strong className="text-slate-200 font-semibold">{stats.triangleCount.toLocaleString()}</strong>
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              Build Plate: 250×250mm Standard
            </div>
          </div>
        ) : (
          <div />
        )}

        <div className="pointer-events-auto flex items-center gap-1 bg-slate-900/85 backdrop-blur-md p-1 rounded-lg border border-slate-700/60 shadow-lg text-slate-300">
          <button
            type="button"
            id="stl-zoom-in"
            onClick={zoomIn}
            className="p-1.5 rounded hover:bg-slate-800 hover:text-white transition"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            id="stl-zoom-out"
            onClick={zoomOut}
            className="p-1.5 rounded hover:bg-slate-800 hover:text-white transition"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Subtle interaction tip */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-hover:opacity-10 transition-opacity duration-300">
        <span className="text-xs text-slate-400 bg-slate-900/80 px-2.5 py-1 rounded-full border border-slate-700">
          Drag to rotate • Scroll to zoom
        </span>
      </div>
    </div>
  );
};
