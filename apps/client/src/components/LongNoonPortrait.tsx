import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

type Props = {
  className?: string;
  name: string;
};

const PRISM_Y = -0.6;
const PRISM_SCALE = 0.56;
const ROTATION_SPEED = 0.92;
const GLASS_OPACITY = 0.66;
const SPECTRAL_GLASS_OPACITY = 0.17;

const SUN_TEXTURE_PATH = "/textures/sun.jpg";
const SUN_RADIUS = 0.32;
const SUN_ROTATION_SPEED = -0.23;

const HALO_Y = 0.40;
const HALO_RADIUS = 0.88;
const HALO_TUBE = 0.032;

function makeProceduralSunTexture(size = 512) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const image = ctx.createImageData(size, size);
  const data = image.data;

  const rand = (x: number, y: number, scale: number) => {
    const sx = Math.floor(x / scale);
    const sy = Math.floor(y / scale);
    const value = Math.sin(sx * 12.9898 + sy * 78.233) * 43758.5453;
    return value - Math.floor(value);
  };

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;

      const broad = rand(x, y, 28);
      const medium = rand(x, y, 11);
      const fine = rand(x, y, 4);
      const waves =
        Math.sin(x * 0.055 + Math.sin(y * 0.025) * 2.2) * 0.5 +
        Math.sin(y * 0.075 + x * 0.012) * 0.25;

      const v = Math.max(
        0,
        Math.min(1, broad * 0.34 + medium * 0.34 + fine * 0.22 + waves * 0.1 + 0.2),
      );

      data[i] = Math.round(210 + v * 45);
      data[i + 1] = Math.round(82 + v * 150);
      data[i + 2] = Math.round(18 + v * 62);
      data[i + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);

  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = 0.22;
  for (let i = 0; i < 34; i += 1) {
    const y = Math.random() * size;
    const amplitude = 4 + Math.random() * 12;
    const frequency = 0.008 + Math.random() * 0.018;

    ctx.beginPath();
    for (let x = 0; x <= size; x += 4) {
      const py = y + Math.sin(x * frequency + i) * amplitude;
      if (x === 0) ctx.moveTo(x, py);
      else ctx.lineTo(x, py);
    }
    ctx.strokeStyle = i % 3 === 0 ? "#fff2a8" : "#ffb23c";
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;

  return texture;
}

function makeGlowTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );

  gradient.addColorStop(0, "rgba(255,255,235,1)");
  gradient.addColorStop(0.18, "rgba(255,224,122,0.9)");
  gradient.addColorStop(0.42, "rgba(255,154,44,0.38)");
  gradient.addColorStop(0.7, "rgba(255,103,24,0.1)");
  gradient.addColorStop(1, "rgba(255,103,24,0)");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function makeHaloAuraTexture(size = 512) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.33;

  ctx.clearRect(0, 0, size, size);
  ctx.globalCompositeOperation = "lighter";

  // Broad warm aura around the ring.
  for (let width = 54; width >= 8; width -= 6) {
    const t = (width - 8) / 46;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, ${Math.round(174 + (1 - t) * 42)}, ${Math.round(
      66 + (1 - t) * 82,
    )}, ${0.012 + (1 - t) * 0.022})`;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  // Thin white-gold center that visually joins the aura to the torus.
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,247,207,0.34)";
  ctx.lineWidth = 5;
  ctx.stroke();

  // Sparse irregular rays. They remain subtle enough that the torus still
  // reads as the actual object rather than a flat graphic.
  const rayCount = 30;
  for (let i = 0; i < rayCount; i += 1) {
    const angle = (i / rayCount) * Math.PI * 2 + Math.sin(i * 1.7) * 0.035;
    const inner = radius + 28 + (i % 4) * 3;
    const outer = inner + 22 + ((i * 17) % 34);
    const alpha = 0.035 + (i % 5) * 0.006;

    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
    ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
    ctx.strokeStyle = `rgba(255,211,112,${alpha})`;
    ctx.lineWidth = i % 3 === 0 ? 2 : 1;
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function addRainbowColors(geometry: THREE.BufferGeometry) {
  const position = geometry.getAttribute("position");
  const colors = new Float32Array(position.count * 3);
  const color = new THREE.Color();

  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);

    const angle = Math.atan2(z, x);
    const hue = ((angle / (Math.PI * 2)) + 0.5 + y * 0.08 + 1) % 1;

    color.setHSL(hue, 0.82, 0.62);

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

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnvironment = new RoomEnvironment();
    const environmentTarget = pmremGenerator.fromScene(roomEnvironment, 0.08);
    scene.environment = environmentTarget.texture;

    // 3D halo. The torus is the visible object, with a hot inner core and
    // softer aura layers surrounding it.
    const haloGroup = new THREE.Group();
    haloGroup.position.set(0, HALO_Y, 0);
    haloGroup.rotation.set(1.24, 0.03, -0.015);
    scene.add(haloGroup);

    const haloGeometry = new THREE.TorusGeometry(HALO_RADIUS, HALO_TUBE, 32, 192);
    const haloMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#ffd982"),
      emissive: new THREE.Color("#ffb72f"),
      emissiveIntensity: 2.8,
      roughness: 0.2,
      metalness: 0.12,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
      toneMapped: false,
    });
    const halo = new THREE.Mesh(haloGeometry, haloMaterial);
    haloGroup.add(halo);

    // White-hot center line makes the torus feel luminous instead of metallic.
    const haloCoreGeometry = new THREE.TorusGeometry(
      HALO_RADIUS,
      HALO_TUBE * 0.42,
      24,
      192,
    );
    const haloCoreMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#fff9df"),
      transparent: true,
      opacity: 0.96,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const haloCore = new THREE.Mesh(haloCoreGeometry, haloCoreMaterial);
    haloCore.scale.setScalar(0.997);
    haloGroup.add(haloCore);

    const haloGlowGeometry = new THREE.TorusGeometry(
      HALO_RADIUS,
      HALO_TUBE * 2.15,
      20,
      192,
    );
    const haloGlowMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#ffd16a"),
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const haloGlow = new THREE.Mesh(haloGlowGeometry, haloGlowMaterial);
    haloGroup.add(haloGlow);

    const haloOuterGlowGeometry = new THREE.TorusGeometry(
      HALO_RADIUS,
      HALO_TUBE * 4.7,
      16,
      192,
    );
    const haloOuterGlowMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#ffad32"),
      transparent: true,
      opacity: 0.035,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const haloOuterGlow = new THREE.Mesh(
      haloOuterGlowGeometry,
      haloOuterGlowMaterial,
    );
    haloGroup.add(haloOuterGlow);

    // A soft halo-shaped aura gives the torus a proper burn and a handful of
    // restrained rays while staying aligned to the 3D object's plane.
    const haloAuraTexture = makeHaloAuraTexture();
    const haloAuraGeometry = new THREE.PlaneGeometry(2.72, 2.72);
    const haloAuraMaterial = new THREE.MeshBasicMaterial({
      map: haloAuraTexture,
      transparent: true,
      opacity: 0.64,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const haloAura = new THREE.Mesh(haloAuraGeometry, haloAuraMaterial);
    haloAura.position.z = -0.012;
    haloGroup.add(haloAura);

    const prism = new THREE.Group();
    prism.position.set(0, PRISM_Y, 0);
    prism.scale.setScalar(PRISM_SCALE);
    prism.rotation.set(0.28, -0.58, 0.055);
    scene.add(prism);

    const geometry = new THREE.DodecahedronGeometry(1, 0);
    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#f4f8ff"),
      metalness: 0.4,
      roughness: 0.095,
      transmission: 1,
      thickness: 0.52,
      ior: 1.46,
      transparent: true,
      opacity: GLASS_OPACITY,
      depthWrite: false,
      iridescence: 0.92,
      iridescenceIOR: 1.32,
      iridescenceThicknessRange: [80, 620],
      attenuationColor: new THREE.Color("#eef5ff"),
      attenuationDistance: 20,
      clearcoat: 0.48,
      clearcoatRoughness: 0.075,
      specularIntensity: 0.65,
      specularColor: new THREE.Color("#eaf2ff"),
      side: THREE.FrontSide,
    });
    const glass = new THREE.Mesh(geometry, glassMaterial);
    prism.add(glass);

    const spectralGeometry = new THREE.DodecahedronGeometry(0.985, 0).toNonIndexed();
    addRainbowColors(spectralGeometry);

    const spectralMaterial = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: SPECTRAL_GLASS_OPACITY,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });

    const spectralGlass = new THREE.Mesh(spectralGeometry, spectralMaterial);
    prism.add(spectralGlass);

    const edgeGeometry = new THREE.EdgesGeometry(geometry, 10);
    const edgeMaterial = new THREE.LineBasicMaterial({
      color: new THREE.Color("#d8bd70"),
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    });
    prism.add(new THREE.LineSegments(edgeGeometry, edgeMaterial));

    const sunGroup = new THREE.Group();
    sunGroup.position.set(0, 0.035, 0);
    prism.add(sunGroup);

    const proceduralSunTexture = makeProceduralSunTexture();
    const textureLoader = new THREE.TextureLoader();

    const sunMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#ffb347"),
      map: proceduralSunTexture,
      emissiveMap: proceduralSunTexture,
      emissive: new THREE.Color("#ff8a24"),
      emissiveIntensity: 1.8,
      roughness: 0.8,
      metalness: 0,
      toneMapped: false,
    });

    let loadedSunTexture: THREE.Texture | null = null;
    textureLoader.load(
      SUN_TEXTURE_PATH,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.needsUpdate = true;
        loadedSunTexture = texture;
        sunMaterial.map = texture;
        sunMaterial.emissiveMap = texture;
        sunMaterial.needsUpdate = true;
      },
      undefined,
      () => {},
    );

    const sunGeometry = new THREE.SphereGeometry(SUN_RADIUS, 64, 64);
    const sun = new THREE.Mesh(sunGeometry, sunMaterial);
    sunGroup.add(sun);

    const photosphereGeometry = new THREE.SphereGeometry(SUN_RADIUS * 1.08, 48, 48);
    const photosphereMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#ffb13a"),
      transparent: true,
      opacity: 0.1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.BackSide,
      toneMapped: false,
    });
    const photosphere = new THREE.Mesh(photosphereGeometry, photosphereMaterial);
    sunGroup.add(photosphere);

    const glowTexture = makeGlowTexture();

    const coronaMaterial = new THREE.SpriteMaterial({
      map: glowTexture,
      color: new THREE.Color("#ffb04a"),
      transparent: true,
      opacity: 0.58,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const corona = new THREE.Sprite(coronaMaterial);
    corona.scale.setScalar(0.62);
    sunGroup.add(corona);

    const outerCoronaMaterial = new THREE.SpriteMaterial({
      map: glowTexture,
      color: new THREE.Color("#ffd27a"),
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const outerCorona = new THREE.Sprite(outerCoronaMaterial);
    outerCorona.scale.setScalar(0.92);
    sunGroup.add(outerCorona);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    scene.add(new THREE.HemisphereLight(0xffedc9, 0x182446, 0.7));

    const amberLight = new THREE.DirectionalLight(0xffd18c, 0.9);
    amberLight.position.set(3.2, 3.5, 4.5);
    scene.add(amberLight);

    const coolLight = new THREE.DirectionalLight(0xb8d2ff, 0.48);
    coolLight.position.set(-4.5, 1.2, 3.2);
    scene.add(coolLight);

    const backLight = new THREE.DirectionalLight(0xf3d8ff, 0.2);
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

      // Keep the torus mostly stable. The tiny precession is enough to reveal
      // its 3D thickness without making it wobble around the card.
      haloGroup.rotation.x = 1.24 + Math.sin(time * 0.0003) * 0.022;
      haloGroup.rotation.y = 0.03 + Math.sin(time * 0.00024 + 0.7) * 0.032;
      haloGroup.rotation.z = -0.015 + Math.sin(time * 0.0002 + 1.1) * 0.012;

      const haloPulse = 0.5 + 0.5 * Math.sin(time * 0.00125);
      haloMaterial.emissiveIntensity = 2.65 + haloPulse * 0.28;
      haloCoreMaterial.opacity = 0.92 + haloPulse * 0.06;
      haloGlowMaterial.opacity = 0.1 + haloPulse * 0.035;
      haloOuterGlowMaterial.opacity = 0.028 + haloPulse * 0.018;
      haloAuraMaterial.opacity = 0.56 + haloPulse * 0.12;

      haloGlow.scale.setScalar(0.998 + haloPulse * 0.005);
      haloOuterGlow.scale.setScalar(0.995 + haloPulse * 0.011);
      haloAura.scale.setScalar(0.992 + haloPulse * 0.016);

      spectralGlass.rotation.y = Math.sin(time * 0.00022) * 0.16;
      spectralGlass.rotation.x = Math.sin(time * 0.00017 + 0.8) * 0.08;

      sun.rotation.y = (sun.rotation.y + delta * SUN_ROTATION_SPEED) % (Math.PI * 2);
      sun.rotation.x = (sun.rotation.x + delta * 0.025) % (Math.PI * 2);

      const activeTexture = loadedSunTexture ?? proceduralSunTexture;
      if (activeTexture) {
        activeTexture.offset.x = (activeTexture.offset.x + delta * 0.0075) % 1;
      }

      const pulse = Math.sin(time * 0.002);
      const slowPulse = Math.sin(time * 0.00135 + 0.9);

      photosphere.scale.setScalar(1 + pulse * 0.018);
      photosphereMaterial.opacity = 0.09 + pulse * 0.018;

      corona.scale.setScalar(0.62 + pulse * 0.025);
      coronaMaterial.opacity = 0.55 + pulse * 0.08;

      outerCorona.scale.setScalar(0.92 + slowPulse * 0.055);
      outerCoronaMaterial.opacity = 0.2 + slowPulse * 0.045;

      sunMaterial.emissiveIntensity = 1.75 + pulse * 0.18;

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
      haloGroup.rotation.set(1.24, 0.03, -0.015);
      sun.rotation.set(0, 0, 0);
      startAnimation();
    };

    reducedMotion.addEventListener("change", handleMotionChange);
    startAnimation();

    return () => {
      stopAnimation();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      reducedMotion.removeEventListener("change", handleMotionChange);

      haloGeometry.dispose();
      haloMaterial.dispose();
      haloCoreGeometry.dispose();
      haloCoreMaterial.dispose();
      haloGlowGeometry.dispose();
      haloGlowMaterial.dispose();
      haloOuterGlowGeometry.dispose();
      haloOuterGlowMaterial.dispose();
      haloAuraGeometry.dispose();
      haloAuraMaterial.dispose();
      haloAuraTexture?.dispose();

      geometry.dispose();
      glassMaterial.dispose();
      spectralGeometry.dispose();
      spectralMaterial.dispose();
      edgeGeometry.dispose();
      edgeMaterial.dispose();

      sunGeometry.dispose();
      sunMaterial.dispose();
      photosphereGeometry.dispose();
      photosphereMaterial.dispose();
      coronaMaterial.dispose();
      outerCoronaMaterial.dispose();

      proceduralSunTexture?.dispose();
      loadedSunTexture?.dispose();
      glowTexture?.dispose();

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
      style={{
        background:
          "radial-gradient(circle at 12% -5%, #9f7cff2e, #0000 28%), radial-gradient(circle at 84% 10%, #5aa1961f, #0000 34%), linear-gradient(#0a0c15 0%, #10131e 52%, #0d1019 100%)",
      }}
      role="img"
      aria-label={`${name}, a three-dimensional radiant halo above a rainbow-glass dodecahedron containing a miniature sun`}
    >
      <canvas ref={canvasRef} className="long-noon-canvas" aria-hidden="true" />
    </div>
  );
}
