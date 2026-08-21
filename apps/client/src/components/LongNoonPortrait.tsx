import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

type Props = {
  className?: string;
  name: string;
};

/*
 * Easy visual tuning:
 * - PRISM_Y: more negative = lower
 * - PRISM_SCALE: smaller number = smaller prism
 * - ROTATION_SPEED: larger number = faster rotation
 * - GLASS_OPACITY: smaller number = more transparent
 * - SPECTRAL_OPACITY: larger number = stronger rainbow tint
 */
const PRISM_Y = -0.70;
const PRISM_SCALE = 0.52;
const ROTATION_SPEED = 0.42;
const GLASS_OPACITY = 0.18;
const SPECTRAL_OPACITY = 0.32;

function addSpectralColors(geometry: THREE.BufferGeometry) {
  const position = geometry.getAttribute("position");
  const colors = new Float32Array(position.count * 3);
  const color = new THREE.Color();

  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);

    const angle = Math.atan2(z, x);
    const hue = ((angle / (Math.PI * 2)) + 0.5 + y * 0.055 + 1) % 1;

    color.setHSL(hue, 0.78, 0.62);

    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
}

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

    // Broad environment reflections give the glass soft highlights
    // instead of tiny white point-light dots.
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
      metalness: 0.08,
      roughness: 0.24,
      transmission: 0.98,
      thickness: 0.55,
      ior: 1.46,

      transparent: true,
      opacity: GLASS_OPACITY,
      depthWrite: false,

      iridescence: 0.24,
      iridescenceIOR: 1.2,
      iridescenceThicknessRange: [110, 310],

      attenuationColor: new THREE.Color("#eef5ff"),
      attenuationDistance: 18,

      clearcoat: 0.45,
      clearcoatRoughness: 0.24,

      specularIntensity: 0.42,
      specularColor: new THREE.Color("#eaf2ff"),

      side: THREE.FrontSide,
    });

    const glass = new THREE.Mesh(geometry, glassMaterial);
    prism.add(glass);

    /*
     * The rainbow is supplied by a faint inner shell rather than by
     * colored point lights. This keeps the hues broad and diffuse.
     */
    const spectralGeometry = new THREE.DodecahedronGeometry(0.965, 0).toNonIndexed();
    addSpectralColors(spectralGeometry);

    const spectralMaterial = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: SPECTRAL_OPACITY,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const spectralShell = new THREE.Mesh(spectralGeometry, spectralMaterial);
    prism.add(spectralShell);

    const edgeGeometry = new THREE.EdgesGeometry(geometry, 10);
    const edgeMaterial = new THREE.LineBasicMaterial({
      color: new THREE.Color("#d8bd70"),
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    });

    prism.add(new THREE.LineSegments(edgeGeometry, edgeMaterial));

    // Broad illumination only. No PointLights.
    scene.add(new THREE.AmbientLight(0xffffff, 0.62));
    scene.add(new THREE.HemisphereLight(0xffedc9, 0x182446, 0.72));

    const amberLight = new THREE.DirectionalLight(0xffb45f, 1.15);
    amberLight.position.set(3.2, 3.5, 4.5);
    scene.add(amberLight);

    const blueLight = new THREE.DirectionalLight(0x74aaff, 0.82);
    blueLight.position.set(-4.5, 1.2, 3.2);
    scene.add(blueLight);

    const roseLight = new THREE.DirectionalLight(0xff7fa9, 0.58);
    roseLight.position.set(3.5, -2.5, 2.2);
    scene.add(roseLight);

    const violetLight = new THREE.DirectionalLight(0xab8cff, 0.48);
    violetLight.position.set(-2.8, -3.4, 1.2);
    scene.add(violetLight);

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

      const delta = previousTime
        ? Math.min((time - previousTime) / 1000, 0.1)
        : 0;

      previousTime = time;

      prism.rotation.y =
        (prism.rotation.y + delta * ROTATION_SPEED) % (Math.PI * 2);

      prism.rotation.x = 0.28 + Math.sin(time * 0.00014) * 0.018;
      prism.rotation.z = 0.055 + Math.sin(time * 0.0001) * 0.009;

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
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }

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

      if (isVisible) {
        startAnimation();
      } else {
        stopAnimation();
      }
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
      spectralGeometry.dispose();
      spectralMaterial.dispose();
      edgeGeometry.dispose();
      edgeMaterial.dispose();

      environmentTarget.dispose();
      pmremGenerator.dispose();

      roomEnvironment.traverse((object) => {
        const mesh = object as THREE.Mesh;

        if (mesh.geometry) {
          mesh.geometry.dispose();
        }

        if (mesh.material) {
          const materials = Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material];

          for (const material of materials) {
            material.dispose();
          }
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
      <canvas
        ref={canvasRef}
        className="long-noon-canvas"
        aria-hidden="true"
      />
    </div>
  );
}
