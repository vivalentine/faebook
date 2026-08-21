import sunTextureUrl from "../assets/sun.jpg";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

type Props = {
  className?: string;
  name: string;
};

const PRISM_Y = -0.6;
const PRISM_SCALE = 0.48;
const ROTATION_SPEED = 0.88;
const GLASS_OPACITY = 0.52;
const SPECTRAL_GLASS_OPACITY = 0.14;

const SUN_RADIUS = 0.52;
const SUN_ROTATION_SPEED = -0.16;
const SUN_HOME_Y = 0.035;
const SUN_BOUNCE_X = 0.095;
const SUN_BOUNCE_Y = 0.082;
const SUN_BOUNCE_Z = 0.056;

const HALO_Y = 0.26;
const HALO_RADIUS = 0.86;
const HALO_TUBE = 0.018;

const BOUNCE_AMOUNT = 0.024;
const BOUNCE_SPEED = 0.001;

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
        Math.min(
          1,
          broad * 0.34 +
            medium * 0.34 +
            fine * 0.22 +
            waves * 0.1 +
            0.2,
        ),
      );

      data[i] = Math.round(120 + v * 125);
      data[i + 1] = Math.round(25 + v * 75);
      data[i + 2] = Math.round(145 + v * 110);
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

    ctx.strokeStyle = i % 3 === 0 ? "#f08bda" : "#6d0088";
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
  gradient.addColorStop(0.18, "rgba(191, 122, 255, 0.9)");
  gradient.addColorStop(0.42, "rgba(160, 44, 255, 0.38)");
  gradient.addColorStop(0.7, "rgba(247, 24, 255, 0.1)");
  gradient.addColorStop(1, "rgba(255, 24, 166, 0)");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

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

export default function LongNoonPortrait({
  className = "",
  name,
}: Props) {
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
    const environmentTarget = pmremGenerator.fromScene(
      roomEnvironment,
      0.04,
    );
    scene.environment = environmentTarget.texture;

    const haloGroup = new THREE.Group();
    haloGroup.position.set(0, HALO_Y, 0);
    haloGroup.rotation.set(1.24, 0.03, -0.01);
    scene.add(haloGroup);

    const haloGeometry = new THREE.TorusGeometry(
      HALO_RADIUS,
      HALO_TUBE,
      32,
      160,
    );

    const haloMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#fff1c6"),
      emissive: new THREE.Color("#f2bf63"),
      emissiveIntensity: 1.45,
      roughness: 0.18,
      metalness: 0.92,
      toneMapped: false,
    });

    const halo = new THREE.Mesh(haloGeometry, haloMaterial);
    haloGroup.add(halo);

    const haloCoreGeometry = new THREE.TorusGeometry(
      HALO_RADIUS,
      HALO_TUBE * 0.48,
      24,
      160,
    );

    const haloCoreMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#fff8df"),
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });

    const haloCore = new THREE.Mesh(haloCoreGeometry, haloCoreMaterial);
    haloCore.scale.setScalar(0.992);
    haloGroup.add(haloCore);

    const haloGlowGeometry = new THREE.TorusGeometry(
      HALO_RADIUS,
      HALO_TUBE * 1.9,
      24,
      160,
    );

    const haloGlowMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#ffd57f"),
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });

    const haloGlow = new THREE.Mesh(
      haloGlowGeometry,
      haloGlowMaterial,
    );
    haloGlow.scale.setScalar(1.012);
    haloGroup.add(haloGlow);

    const haloOuterGlowGeometry = new THREE.TorusGeometry(
      HALO_RADIUS,
      HALO_TUBE * 3.2,
      20,
      160,
    );

    const haloOuterGlowMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#ffb347"),
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
    haloOuterGlow.scale.setScalar(1.024);
    haloGroup.add(haloOuterGlow);

    const prism = new THREE.Group();
    prism.position.set(0, PRISM_Y, 0);
    prism.scale.setScalar(PRISM_SCALE);
    prism.rotation.set(0.28, -0.58, 0.055);
    scene.add(prism);

    const geometry = new THREE.DodecahedronGeometry(1, 0);

    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#f4f8ff"),
      metalness: 0.48,
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

    const spectralGeometry = new THREE.DodecahedronGeometry(
      0.985,
      0,
    );

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

    const spectralGlass = new THREE.Mesh(
      spectralGeometry,
      spectralMaterial,
    );
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
    sunGroup.position.set(0, SUN_HOME_Y, 0);
    prism.add(sunGroup);

    const proceduralSunTexture = makeProceduralSunTexture();
    const textureLoader = new THREE.TextureLoader();

    const sunMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#ffffff"),
      map: proceduralSunTexture,
      toneMapped: false,
    });

    let loadedSunTexture: THREE.Texture | null = null;

    textureLoader.load(
      sunTextureUrl,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        texture.needsUpdate = true;

        loadedSunTexture = texture;
        sunMaterial.map = texture;
        sunMaterial.needsUpdate = true;

        console.log("Loaded Long Noon sun texture:", sunTextureUrl);
      },
      undefined,
      (error) => {
        console.error("FAILED to load Long Noon sun texture:", sunTextureUrl, error);
      },
    );

    const sunGeometry = new THREE.SphereGeometry(
      SUN_RADIUS,
      64,
      64,
    );

    const sun = new THREE.Mesh(sunGeometry, sunMaterial);
    sunGroup.add(sun);

    const photosphereGeometry = new THREE.SphereGeometry(
      SUN_RADIUS * 1.08,
      48,
      48,
    );

    const photosphereMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#d84cff"),
      transparent: true,
      opacity: 0.055,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.BackSide,
      toneMapped: false,
    });

    const photosphere = new THREE.Mesh(
      photosphereGeometry,
      photosphereMaterial,
    );
    sunGroup.add(photosphere);

    const glowTexture = makeGlowTexture();

    const coronaMaterial = new THREE.SpriteMaterial({
      map: glowTexture,
      color: new THREE.Color("#df55ff"),
      transparent: true,
      opacity: 0.26,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });

    const corona = new THREE.Sprite(coronaMaterial);
    corona.scale.setScalar(0.62);
    sunGroup.add(corona);

    const outerCoronaMaterial = new THREE.SpriteMaterial({
      map: glowTexture,
      color: new THREE.Color("#8f63ff"),
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });

    const outerCorona = new THREE.Sprite(outerCoronaMaterial);
    outerCorona.scale.setScalar(0.92);
    sunGroup.add(outerCorona);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    scene.add(
      new THREE.HemisphereLight(0xffedc9, 0x182446, 0.7),
    );

    const amberLight = new THREE.DirectionalLight(
      0xffd18c,
      0.9,
    );
    amberLight.position.set(3.2, 3.5, 4.5);
    scene.add(amberLight);

    const coolLight = new THREE.DirectionalLight(
      0xb8d2ff,
      0.48,
    );
    coolLight.position.set(-4.5, 1.2, 3.2);
    scene.add(coolLight);

    const backLight = new THREE.DirectionalLight(
      0xf3d8ff,
      0.2,
    );
    backLight.position.set(-2.5, -3.2, -2.2);
    scene.add(backLight);

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );

    let isVisible = true;
    let frameId = 0;
    let previousTime = 0;
    let sunWorldAngle = 0;

    const prismWorldQuaternion = new THREE.Quaternion();
    const inversePrismQuaternion = new THREE.Quaternion();
    const desiredSunQuaternion = new THREE.Quaternion();
    const sunAxis = new THREE.Vector3(0, 1, 0);

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

      const bounce =
        Math.sin(time * BOUNCE_SPEED) * BOUNCE_AMOUNT;

      const drift =
        Math.sin(time * 0.0011 + 0.8) * 0.012;

      haloGroup.position.y = HALO_Y + bounce + drift;

      prism.rotation.y =
        (prism.rotation.y + delta * ROTATION_SPEED) %
        (Math.PI * 2);

      prism.rotation.x =
        0.28 + Math.sin(time * 0.00014) * 0.018;

      prism.rotation.z =
        0.055 + Math.sin(time * 0.0001) * 0.009;

      haloGroup.rotation.x =
        1.24 + Math.sin(time * 0.00022) * 0.018;

      haloGroup.rotation.y =
        0.03 + Math.sin(time * 0.00018 + 0.7) * 0.035;

      haloGroup.rotation.z =
        -0.015 + Math.sin(time * 0.00016 + 1.1) * 0.014;

      const haloPulse =
        0.985 + Math.sin(time * 0.0016) * 0.02;

      const haloPulse2 =
        0.99 + Math.sin(time * 0.0012 + 0.9) * 0.018;

      halo.scale.setScalar(haloPulse);

      haloCore.scale.setScalar(
        0.992 * (1 + Math.sin(time * 0.0019) * 0.01),
      );

      haloGlow.scale.setScalar(1.012 * haloPulse2);

      haloOuterGlow.scale.setScalar(
        1.024 *
          (1 + Math.sin(time * 0.0014 + 1.3) * 0.028),
      );

      haloMaterial.emissiveIntensity =
        1.28 + Math.sin(time * 0.0016) * 0.14;

      haloCoreMaterial.opacity =
        0.94 + Math.sin(time * 0.0018) * 0.04;

      haloGlowMaterial.opacity =
        0.14 + Math.sin(time * 0.0014 + 0.5) * 0.03;

      haloOuterGlowMaterial.opacity =
        0.05 + Math.sin(time * 0.0012 + 1.1) * 0.012;

      spectralGlass.rotation.y =
        Math.sin(time * 0.00022) * 0.16;

      spectralGlass.rotation.x =
        Math.sin(time * 0.00017 + 0.8) * 0.08;

      // The sun moves around inside the prism on a smooth, tightly bounded
      // three-axis path. The mixed frequencies keep the motion organic
      // without letting it drift anywhere near the glass shell.
      const sunBounceX =
        Math.sin(time * 0.00154) * SUN_BOUNCE_X +
        Math.sin(time * 0.001107 + 0.7) * 0.014;

      const sunBounceY =
        Math.sin(time * 0.00169 + 1.15) * SUN_BOUNCE_Y +
        Math.sin(time * 0.00131 + 2.0) * 0.01;

      const sunBounceZ =
        Math.sin(time * 0.00161 + 2.25) * SUN_BOUNCE_Z +
        Math.sin(time * 0.01113 + 0.35) * 0.012;

      sunGroup.position.set(
        sunBounceX,
        SUN_HOME_Y + sunBounceY,
        sunBounceZ,
      );

      // Keep the miniature sun's rotation independent from the prism.
      // Child world rotation = prism world rotation * child local rotation,
      // so cancel the prism first, then apply the slow counterrotation.
      sunWorldAngle =
        (sunWorldAngle + delta * SUN_ROTATION_SPEED) %
        (Math.PI * 2);

      desiredSunQuaternion.setFromAxisAngle(
        sunAxis,
        sunWorldAngle,
      );

      prism.getWorldQuaternion(prismWorldQuaternion);
      inversePrismQuaternion
        .copy(prismWorldQuaternion)
        .invert();

      sunGroup.quaternion
        .copy(inversePrismQuaternion)
        .multiply(desiredSunQuaternion);

      const activeTexture =
        loadedSunTexture ?? proceduralSunTexture;

      if (activeTexture) {
        activeTexture.offset.x =
          (activeTexture.offset.x + delta * 0.0075) % 1;
      }

      const pulse = Math.sin(time * 0.002);
      const slowPulse = Math.sin(time * 0.00135 + 0.9);

      photosphere.scale.setScalar(1 + pulse * 0.018);
      photosphereMaterial.opacity =
        0.09 + pulse * 0.018;

      corona.scale.setScalar(0.62 + pulse * 0.025);
      coronaMaterial.opacity =
        0.55 + pulse * 0.08;

      outerCorona.scale.setScalar(
        0.92 + slowPulse * 0.055,
      );

      outerCoronaMaterial.opacity =
        0.12 + slowPulse * 0.045;

      render();
      frameId = window.requestAnimationFrame(animate);
    };

    const startAnimation = () => {
      render();

      if (
        isVisible &&
        !reducedMotion.matches &&
        frameId === 0
      ) {
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

      renderer.setPixelRatio(
        Math.min(window.devicePixelRatio || 1, 2),
      );

      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      render();
    });

    resizeObserver.observe(host);

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;

        if (isVisible) {
          startAnimation();
        } else {
          stopAnimation();
        }
      },
    );

    intersectionObserver.observe(host);

    const handleMotionChange = () => {
      stopAnimation();

      haloGroup.position.set(0, HALO_Y, 0);

      prism.rotation.set(0.28, -0.58, 0.055);
      haloGroup.rotation.set(1.24, 0.03, -0.015);
      sunWorldAngle = 0;
      sunGroup.position.set(0, SUN_HOME_Y, 0);
      sunGroup.quaternion.identity();
      sun.rotation.set(0, 0, 0);

      startAnimation();
    };

    reducedMotion.addEventListener(
      "change",
      handleMotionChange,
    );

    startAnimation();

    return () => {
      stopAnimation();

      resizeObserver.disconnect();
      intersectionObserver.disconnect();

      reducedMotion.removeEventListener(
        "change",
        handleMotionChange,
      );

      haloGeometry.dispose();
      haloMaterial.dispose();
      haloCoreGeometry.dispose();
      haloCoreMaterial.dispose();
      haloGlowGeometry.dispose();
      haloGlowMaterial.dispose();
      haloOuterGlowGeometry.dispose();
      haloOuterGlowMaterial.dispose();

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

        if (mesh.geometry) {
          mesh.geometry.dispose();
        }

        if (mesh.material) {
          const materials = Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material];

          materials.forEach((material) =>
            material.dispose(),
          );
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
      style={{ background: "transparent" }}
      role="img"
      aria-label={`${name}, a three-dimensional radiant halo above a rainbow-glass dodecahedron containing a miniature sun`}
    >
      <canvas
        ref={canvasRef}
        className="long-noon-canvas"
        aria-hidden="true"
      />
    </div>
  );
}
