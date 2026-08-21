import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

type Props = {
  className?: string;
  name: string;
};

export default function LongNoonPortrait({ className = "", name }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 0.08, 4.8);
    camera.lookAt(0, -0.38, 0);

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;

    // Give the transmission shader a soft reflected environment. Without an
    // environment, transparent physical glass can read as a flat pale solid.
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnvironment = new RoomEnvironment();
    const environmentMap = pmremGenerator.fromScene(roomEnvironment, 0.04).texture;
    scene.environment = environmentMap;

    const prism = new THREE.Group();
    prism.position.set(0, -0.62, 0);
    prism.scale.setScalar(0.68);
    scene.add(prism);

    const geometry = new THREE.DodecahedronGeometry(1, 0);
    const material = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0xf7fbff),
      metalness: 0.05,
      roughness: 0.08,
      transmission: 1,
      thickness: 1.05,
      ior: 1.48,
      iridescence: 0.62,
      iridescenceIOR: 1.22,
      iridescenceThicknessRange: [90, 340],
      attenuationColor: new THREE.Color(0xeef5ff),
      attenuationDistance: 14,
      opacity: 0.68,
      transparent: true,
      side: THREE.DoubleSide,
      clearcoat: 0.35,
      clearcoatRoughness: 0.08,
      specularIntensity: 0.8,
      specularColor: new THREE.Color(0xffffff),
    });

    const glass = new THREE.Mesh(geometry, material);
    prism.add(glass);

    const edgeGeometry = new THREE.EdgesGeometry(geometry, 1);
    const edgeMaterial = new THREE.LineBasicMaterial({
      color: new THREE.Color(0xd7bd72),
      transparent: true,
      opacity: 0.72,
    });
    const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
    edges.renderOrder = 3;
    prism.add(edges);

    // Neutral illumination keeps the body clear. Low-intensity spectral fills
    // supply the restrained rainbow glints as the prism turns.
    scene.add(new THREE.HemisphereLight(0xfffbec, 0x151b32, 0.75));

    const key = new THREE.DirectionalLight(0xfff4d6, 2.1);
    key.position.set(2.8, 3.6, 4.2);
    scene.add(key);

    const cool = new THREE.PointLight(0x8ec8ff, 5.5, 10, 2);
    cool.position.set(-2.7, 0.2, 2.3);
    scene.add(cool);

    const rose = new THREE.PointLight(0xffa8c8, 4.2, 9, 2);
    rose.position.set(2.4, -1.2, 1.9);
    scene.add(rose);

    const violet = new THREE.PointLight(0xbda8ff, 3.4, 8, 2);
    violet.position.set(-1.2, -2.1, 0.9);
    scene.add(violet);

    const gold = new THREE.PointLight(0xffd98a, 4.6, 9, 2);
    gold.position.set(1.8, 1.5, -1.3);
    scene.add(gold);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let isVisible = true;
    let frameId = 0;
    let previousTime = 0;

    prism.rotation.set(0.27, -0.58, 0.035);

    const render = () => renderer.render(scene, camera);

    const animate = (time: number) => {
      if (!isVisible || reducedMotion.matches) {
        frameId = 0;
        return;
      }

      const delta = previousTime ? Math.min((time - previousTime) / 1000, 0.1) : 0;
      previousTime = time;

      prism.rotation.y = (prism.rotation.y + delta * 0.32) % (Math.PI * 2);
      prism.rotation.x = 0.27 + Math.sin(time * 0.00013) * 0.018;
      prism.rotation.z = 0.035 + Math.sin(time * 0.00009) * 0.008;

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
      prism.rotation.set(0.27, -0.58, 0.035);
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
      material.dispose();
      edgeGeometry.dispose();
      edgeMaterial.dispose();
      environmentMap.dispose();
      pmremGenerator.dispose();
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
