import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

type Props = {
  className?: string;
  name: string;
};

const PRISM_Y = -0.7;
const PRISM_SCALE = 0.62;
const ROTATION_SPEED = 0.72;
const GLASS_OPACITY = 0.68;

export default function LongNoonPortrait({ className = "", name }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0, 0.08, 4.8);
    camera.lookAt(0, -0.22, 0);

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnvironment = new RoomEnvironment();
    const environmentTarget = pmremGenerator.fromScene(roomEnvironment, 0.08);
    scene.environment = environmentTarget.texture;

    const prism = new THREE.Group();
    prism.position.set(0, PRISM_Y, 0);
    prism.scale.setScalar(PRISM_SCALE);
    prism.rotation.set(0.28, -0.58, 0.055);
    scene.add(prism);

    const geometry = new THREE.DodecahedronGeometry(1, 0);
    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#f4f8ff"),
      metalness: 0.28,
      roughness: 0.08,
      transmission: 1,
      thickness: 0.52,
      ior: 1.46,
      transparent: true,
      opacity: GLASS_OPACITY,
      depthWrite: false,
      iridescence: 0.18,
      iridescenceIOR: 1.2,
      iridescenceThicknessRange: [110, 300],
      attenuationColor: new THREE.Color("#eef5ff"),
      attenuationDistance: 20,
      clearcoat: 0.32,
      clearcoatRoughness: 0.11,
      specularIntensity: 0.78,
      specularColor: new THREE.Color("#eaf2ff"),
      side: THREE.FrontSide,
    });
    const glass = new THREE.Mesh(geometry, glassMaterial);
    prism.add(glass);

    const edgeGeometry = new THREE.EdgesGeometry(geometry, 10);
    const edgeMaterial = new THREE.LineBasicMaterial({
      color: new THREE.Color("#d8bd70"),
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    });
    const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
    prism.add(edges);

    const coreGroup = new THREE.Group();
    coreGroup.position.set(0, 0.04, 0);
    prism.add(coreGroup);

    const coreGeometry = new THREE.SphereGeometry(0.145, 32, 32);
    const coreMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#fff6cf"),
      transparent: true,
      opacity: 0.98,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    coreGroup.add(core);

    const innerGlowGeometry = new THREE.SphereGeometry(0.28, 32, 32);
    const innerGlowMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#ffd778"),
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.BackSide,
    });
    const innerGlow = new THREE.Mesh(innerGlowGeometry, innerGlowMaterial);
    coreGroup.add(innerGlow);

    const outerGlowGeometry = new THREE.SphereGeometry(0.42, 32, 32);
    const outerGlowMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#ffbf66"),
      transparent: true,
      opacity: 0.08,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.BackSide,
    });
    const outerGlow = new THREE.Mesh(outerGlowGeometry, outerGlowMaterial);
    coreGroup.add(outerGlow);

    const spectralGlowGeometry = new THREE.SphereGeometry(0.56, 32, 32);
    const spectralGlowMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#b9c3ff"),
      transparent: true,
      opacity: 0.035,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.BackSide,
    });
    const spectralGlow = new THREE.Mesh(spectralGlowGeometry, spectralGlowMaterial);
    spectralGlow.scale.set(1.08, 0.95, 1.02);
    coreGroup.add(spectralGlow);

    const rayMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#ffe7a8"),
      transparent: true,
      opacity: 0.075,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const rayGeometries: THREE.BufferGeometry[] = [];
    const rayMeshes: THREE.Mesh[] = [];
    const rayData = [
      { rotX: 0.0, rotY: 0.0, rotZ: 0.28, y: 0.02 },
      { rotX: 0.65, rotY: 0.55, rotZ: -0.2, y: -0.01 },
      { rotX: -0.52, rotY: 1.12, rotZ: 0.16, y: 0.05 },
      { rotX: 0.38, rotY: -0.92, rotZ: -0.34, y: -0.04 },
    ];

    for (const ray of rayData) {
      const rayGeometry = new THREE.CylinderGeometry(0.012, 0.04, 1.16, 10, 1, true);
      const rayMesh = new THREE.Mesh(rayGeometry, rayMaterial);
      rayMesh.position.y = ray.y;
      rayMesh.rotation.set(ray.rotX, ray.rotY, ray.rotZ);
      coreGroup.add(rayMesh);
      rayGeometries.push(rayGeometry);
      rayMeshes.push(rayMesh);
    }

    scene.add(new THREE.AmbientLight(0xffffff, 0.62));
    scene.add(new THREE.HemisphereLight(0xffedc9, 0x182446, 0.72));

    const amberLight = new THREE.DirectionalLight(0xffd18c, 0.95);
    amberLight.position.set(3.2, 3.5, 4.5);
    scene.add(amberLight);

    const coolLight = new THREE.DirectionalLight(0xb8d2ff, 0.55);
    coolLight.position.set(-4.5, 1.2, 3.2);
    scene.add(coolLight);

    const backLight = new THREE.DirectionalLight(0xf3d8ff, 0.22);
    backLight.position.set(-2.5, -3.2, -2.2);
    scene.add(backLight);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    let isVisible = true;
    let frameId = 0;
    let previousTime = 0;

    const render = () => renderer.render(scene, camera);

    const animate = (time: number) => {
      if (!isVisible || reducedMotion.matches) {
        frameId = 0;
        return;
      }

      const delta = previousTime ? Math.min((time - previousTime) / 1000, 0.1) : 0;
      previousTime = time;

      prism.rotation.y = (prism.rotation.y + delta * ROTATION_SPEED) % (Math.PI * 2);
      prism.rotation.x = 0.28 + Math.sin(time * 0.00014) * 0.018;
      prism.rotation.z = 0.055 + Math.sin(time * 0.0001) * 0.009;

      const pulse = 0.92 + Math.sin(time * 0.0022) * 0.08;
      const secondaryPulse = 0.94 + Math.sin(time * 0.00155 + 1.2) * 0.06;
      core.scale.setScalar(pulse);
      innerGlow.scale.setScalar(0.98 + Math.sin(time * 0.0019) * 0.06);
      outerGlow.scale.setScalar(secondaryPulse);
      spectralGlow.scale.set(
        1.08 + Math.sin(time * 0.0013) * 0.03,
        0.95 + Math.sin(time * 0.0015 + 0.7) * 0.025,
        1.02 + Math.sin(time * 0.0011 + 1.4) * 0.025,
      );

      coreMaterial.opacity = 0.9 + Math.sin(time * 0.0022) * 0.06;
      innerGlowMaterial.opacity = 0.16 + Math.sin(time * 0.0019) * 0.035;
      outerGlowMaterial.opacity = 0.075 + Math.sin(time * 0.0015 + 0.4) * 0.02;
      spectralGlowMaterial.opacity = 0.03 + Math.sin(time * 0.0011 + 0.9) * 0.012;

      rayMeshes.forEach((mesh, index) => {
        mesh.rotation.y += delta * (0.04 + index * 0.012);
      });

      render();
      frameId = window.requestAnimationFrame(animate);
    };

    const startAnimation = () => {
      render();
      if (isVisible && !reducedMotion.matches && frameId === 0) {
        previousTime = 0;
        frameId = window.requestAnimationFrame(animate);
      }
    };

    const stopAnimation = () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      frameId = 0;
    };

    const resizeObserver = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (!width || !height) return;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      render();
    });
    resizeObserver.observe(host);

    const intersectionObserver = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
      if (isVisible) startAnimation();
      else stopAnimation();
    });
    intersectionObserver.observe(host);

    const handleMotionChange = () => {
      stopAnimation();
      prism.rotation.set(0.28, -0.58, 0.055);
      startAnimation();
    };

    reducedMotion.addEventListener("change", handleMotionChange);
    startAnimation();

    return () => {
      stopAnimation();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      reducedMotion.removeEventListener("change", handleMotionChange);

      geometry.dispose();
      glassMaterial.dispose();
      edgeGeometry.dispose();
      edgeMaterial.dispose();
      coreGeometry.dispose();
      coreMaterial.dispose();
      innerGlowGeometry.dispose();
      innerGlowMaterial.dispose();
      outerGlowGeometry.dispose();
      outerGlowMaterial.dispose();
      spectralGlowGeometry.dispose();
      spectralGlowMaterial.dispose();
      rayGeometries.forEach((g) => g.dispose());
      rayMaterial.dispose();

      environmentTarget.dispose();
      pmremGenerator.dispose();
      roomEnvironment.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          materials.forEach((material) => material.dispose());
        }
      });

      renderer.dispose();
      renderer.forceContextLoss();
    };
  }, []);

  return (
    <div
      ref={hostRef}
      className={`${className} long-noon-portrait`}
      role="img"
      aria-label={`${name}, a radiant halo above a glass dodecahedron`}
    >
      <div className="long-noon-radiance" aria-hidden="true" />
      <div className="long-noon-halo" aria-hidden="true" />
      <canvas ref={canvasRef} className="long-noon-canvas" aria-hidden="true" />
    </div>
  );
}
