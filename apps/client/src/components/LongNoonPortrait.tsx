import { useEffect, useRef } from "react";
import * as THREE from "three";

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
    const camera = new THREE.PerspectiveCamera(31, 1, 0.1, 100);
    camera.position.set(0, 0.05, 6.2);

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;

    const prism = new THREE.Group();
    prism.position.y = -0.62;
    scene.add(prism);

    const geometry = new THREE.DodecahedronGeometry(1.38, 0);
    const material = new THREE.MeshPhysicalMaterial({
      color: 0xfff8df,
      metalness: 0,
      roughness: 0.08,
      transmission: 0.96,
      thickness: 0.72,
      ior: 1.48,
      iridescence: 0.22,
      iridescenceIOR: 1.3,
      iridescenceThicknessRange: [120, 360],
      attenuationColor: new THREE.Color(0xffe8b2),
      attenuationDistance: 5,
      transparent: true,
      opacity: 0.82,
      side: THREE.DoubleSide,
      specularIntensity: 0.9,
      specularColor: new THREE.Color(0xfff7df),
    });
    const glass = new THREE.Mesh(geometry, material);
    prism.add(glass);

    const edgeGeometry = new THREE.EdgesGeometry(geometry, 12);
    const edgeMaterial = new THREE.LineBasicMaterial({
      color: 0xd9ad59,
      transparent: true,
      opacity: 0.58,
    });
    prism.add(new THREE.LineSegments(edgeGeometry, edgeMaterial));

    scene.add(new THREE.HemisphereLight(0xfff4d1, 0x23284a, 1.7));
    const lights: Array<[number, number, number, number, number]> = [
      [0xffe7a1, 2.8, 3.4, 2.7, 10],
      [0xb9d9ff, -2.8, 0.2, 2.2, 4.5],
      [0xffb5cf, 2.4, -1.4, 1.2, 3.2],
      [0xc9b8ff, -1.5, -2.6, 0.8, 2.4],
    ];
    for (const [color, x, y, z, intensity] of lights) {
      const light = new THREE.PointLight(color, intensity, 12, 2);
      light.position.set(x, y, z);
      scene.add(light);
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let isVisible = true;
    let frameId = 0;
    let previousTime = 0;
    prism.rotation.set(0.18, -0.58, -0.04);

    const render = () => renderer.render(scene, camera);
    const animate = (time: number) => {
      if (!isVisible || reducedMotion.matches) {
        frameId = 0;
        return;
      }
      const delta = previousTime ? Math.min((time - previousTime) / 1000, 0.1) : 0;
      previousTime = time;
      prism.rotation.y = (prism.rotation.y + delta * 0.16) % (Math.PI * 2);
      prism.rotation.x = 0.18 + Math.sin(time * 0.00012) * 0.035;
      prism.rotation.z = -0.04 + Math.sin(time * 0.00009) * 0.018;
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
      prism.rotation.set(0.18, -0.58, -0.04);
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
      renderer.dispose();
      renderer.forceContextLoss();
    };
  }, []);

  return (
    <div ref={hostRef} className={`${className} long-noon-portrait`} role="img" aria-label={`${name}, a radiant halo above a glass dodecahedron`}>
      <div className="long-noon-radiance" aria-hidden="true" />
      <div className="long-noon-halo" aria-hidden="true" />
      <canvas ref={canvasRef} className="long-noon-canvas" aria-hidden="true" />
    </div>
  );
}
