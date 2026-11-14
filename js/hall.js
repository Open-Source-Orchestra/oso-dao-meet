import * as THREE from '../vendor/three.module.min.js';
import { VRButton } from '../vendor/VRButton.js';
import { createSlideCanvas } from './slides.js';

const VENUES = {
  mumbai: {
    label: 'Memory gold',
    background: 0x08050d, fog: 0x0d0711, wall: 0x27101c, panel: 0x46162b,
    ceiling: 0x160d1b, gold: 0xd5aa5d, floor: 0x4b281d, carpet: 0x721b36,
    seat: 0x69182f, curtains: 0x5f1028, light: 0xffd1a0, exposure: 1.12
  },
  prague: {
    label: 'Art Nouveau ivory',
    background: 0x19131a, fog: 0x241923, wall: 0x77685f, panel: 0x65414b,
    ceiling: 0x4d444b, gold: 0xe3bd72, floor: 0x684733, carpet: 0x71344c,
    seat: 0x754457, curtains: 0x65313f, light: 0xffe6c4, exposure: 1.23
  },
  cannes: {
    label: 'Premiere night',
    background: 0x070810, fog: 0x0b0c17, wall: 0x171724, panel: 0x29233a,
    ceiling: 0x10111c, gold: 0xc5975e, floor: 0x3a2a28, carpet: 0x8e1831,
    seat: 0x471320, curtains: 0x40101e, light: 0xffdab0, exposure: 1.15
  }
};

const clamp = THREE.MathUtils.clamp;
const geometryCache = new Map();
function boxGeometry(w, h, d) {
  const key = `b${w},${h},${d}`;
  if (!geometryCache.has(key)) geometryCache.set(key, new THREE.BoxGeometry(w, h, d));
  return geometryCache.get(key);
}
function cylinderGeometry(rt, rb, h, segments = 16) {
  const key = `c${rt},${rb},${h},${segments}`;
  if (!geometryCache.has(key)) geometryCache.set(key, new THREE.CylinderGeometry(rt, rb, h, segments));
  return geometryCache.get(key);
}
function sphereGeometry(radius = 1, segments = 18) {
  const key = `s${radius},${segments}`;
  if (!geometryCache.has(key)) geometryCache.set(key, new THREE.SphereGeometry(radius, segments, Math.max(10, segments / 2)));
  return geometryCache.get(key);
}
function mesh(parent, geometry, material, position = [0, 0, 0], rotation = null) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(...position);
  if (rotation) object.rotation.set(...rotation);
  parent.add(object);
  return object;
}
function box(parent, dimensions, material, position, rotation = null) {
  return mesh(parent, boxGeometry(...dimensions), material, position, rotation);
}
function cylinder(parent, dimensions, material, position, rotation = null) {
  return mesh(parent, cylinderGeometry(...dimensions), material, position, rotation);
}
function lineTube(parent, points, radius, material, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)), closed, 'centripetal');
  const geometry = new THREE.TubeGeometry(curve, Math.max(24, points.length * 3), radius, 6, closed);
  return mesh(parent, geometry, material);
}
function arch(parent, rx, ry, baseY, z, material, radius = 0.12) {
  const points = [];
  for (let i = 0; i <= 32; i += 1) {
    const angle = Math.PI - (i / 32) * Math.PI;
    points.push([Math.cos(angle) * rx, baseY + Math.sin(angle) * ry, z]);
  }
  return lineTube(parent, points, radius, material);
}

function createParquetTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#6e4630';
  ctx.fillRect(0, 0, 512, 512);
  for (let row = 0; row < 8; row += 1) {
    for (let col = -1; col < 5; col += 1) {
      const x = col * 128 + (row % 2) * 64;
      const y = row * 64;
      const shade = 54 + ((row * 17 + col * 13 + 130) % 29);
      ctx.fillStyle = `rgb(${shade + 45},${shade + 16},${shade})`;
      ctx.fillRect(x + 2, y + 2, 124, 60);
      ctx.strokeStyle = 'rgba(243,196,118,.10)';
      for (let grain = 0; grain < 3; grain += 1) {
        ctx.beginPath();
        ctx.moveTo(x + 8, y + 15 + grain * 15);
        ctx.bezierCurveTo(x + 42, y + 10 + grain * 16, x + 77, y + 22 + grain * 12, x + 120, y + 12 + grain * 16);
        ctx.stroke();
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(5, 7);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function createPlaceholderTexture(label) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 320;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1b1320';
  ctx.fillRect(0, 0, 512, 320);
  ctx.strokeStyle = '#b9955e';
  ctx.lineWidth = 2;
  ctx.strokeRect(18, 18, 476, 284);
  ctx.fillStyle = '#e2c894';
  ctx.textAlign = 'center';
  ctx.font = 'italic 30px Georgia, serif';
  ctx.fillText(label, 256, 154);
  ctx.font = '16px Arial, sans-serif';
  ctx.fillStyle = '#b9a9b8';
  ctx.fillText('public memory · arriving gently', 256, 190);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** A hand-built, dependency-light concert hall with raycastable slides and memories. */
export class OrchestraHall {
  constructor({ container, vrHost, slides, media, garden = [], slideImages, reducedMotion, onNext, onPhoto, onToast }) {
    this.container = container;
    this.garden = garden;
    this.vrHost = vrHost;
    this.slides = slides;
    this.media = media;
    this.slideImages = slideImages || new Map();
    this.reducedMotion = reducedMotion;
    this.onNext = onNext;
    this.onPhoto = onPhoto;
    this.onToast = onToast;
    this.slideIndex = 0;
    this.venueId = 'mumbai';
    this.photoFrames = [];
    this.interactive = [];
    this.textureCache = new Map();
    this.keys = new Set();
    this.pointers = new Map();
    this.userNavigated = false;
    this.dragged = false;
    this.lastPinch = 0;
    this.photoRequest = 0;
    this.clock = new THREE.Clock();
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(48, 1, 0.08, 115);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 700 ? 1.35 : 1.7));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = window.innerWidth > 760;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.id = 'hall-canvas';
    this.renderer.domElement.tabIndex = 0;
    this.renderer.domElement.setAttribute('aria-label', 'Interactive 3D theater: the orchestra pit on the floor, the living wall, and the projector. Drag to look, use W A S D to walk, click the stage screen for the next slide, and press C for the channels.');
    this.renderer.domElement.setAttribute('aria-describedby', 'canvas-description');
    this.renderer.domElement.dataset.webgl = 'ready';
    this.container.appendChild(this.renderer.domElement);
    this.canvas = this.renderer.domElement;
    this.raycaster = new THREE.Raycaster();
    this.pointerNdc = new THREE.Vector2();
    this.materials = this.createMaterials();
    this.buildLights();
    this.buildArchitecture();
    this.buildStage();
    this.buildSeats();
    this.buildBalconies();
    this.buildChandeliers();
    this.buildVenueDetails();
    this.buildOrchestraPit();
    this.buildPhotoWalls();
    this.setupInteraction();
    this.setupXR();
    this.resize();
    this.resetCamera(false);
    this.renderer.setAnimationLoop(() => this.render());
  }

  createMaterials() {
    const standard = (color, roughness = 0.65, metalness = 0.05) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
    return {
      wall: standard(0x27101c, 0.84),
      panel: standard(0x46162b, 0.66),
      ceiling: standard(0x160d1b, 0.92),
      gold: standard(0xd5aa5d, 0.31, 0.72),
      paleGold: standard(0xf1d69b, 0.32, 0.52),
      darkGold: standard(0x7b552e, 0.44, 0.6),
      floor: new THREE.MeshStandardMaterial({ color: 0x6b4938, map: createParquetTexture(), roughness: 0.5, metalness: 0.12 }),
      carpet: standard(0x721b36, 0.95),
      seat: standard(0x69182f, 0.88),
      seatDark: standard(0x260a17, 0.88),
      curtains: standard(0x5f1028, 0.98),
      wood: standard(0x2d1716, 0.52),
      black: standard(0x08090d, 0.32, 0.34),
      ivory: standard(0xf3e7cc, 0.68),
      paper: new THREE.MeshBasicMaterial({ color: 0xfff3d5, toneMapped: false }),
      warmWhite: new THREE.MeshBasicMaterial({ color: 0xffe4aa, toneMapped: false }),
      blueGlow: new THREE.MeshBasicMaterial({ color: 0x90b8d2, toneMapped: false }),
      instrument: standard(0xb86d2c, 0.42, 0.12),
      instrumentLight: standard(0xe7ad59, 0.46, 0.08),
      string: standard(0xe8cf99, 0.3, 0.7)
    };
  }

  buildLights() {
    this.scene.add(new THREE.AmbientLight(0xffe2cf, 1.15));
    this.hemisphere = new THREE.HemisphereLight(0xffd8b0, 0x190b19, 1.35);
    this.scene.add(this.hemisphere);
    const moon = new THREE.DirectionalLight(0xffdcb5, 2.4);
    moon.position.set(-4, 13, 8);
    moon.castShadow = true;
    moon.shadow.mapSize.set(1024, 1024);
    moon.shadow.camera.left = -15;
    moon.shadow.camera.right = 15;
    moon.shadow.camera.top = 16;
    moon.shadow.camera.bottom = -12;
    moon.shadow.camera.near = 0.5;
    moon.shadow.camera.far = 45;
    this.scene.add(moon);
    [-7, 7].forEach((x) => {
      const spot = new THREE.SpotLight(0xffca8c, 210, 42, Math.PI / 5, 0.65, 1.8);
      spot.position.set(x, 12, 2);
      spot.target.position.set(x * 0.4, 1, -8);
      this.scene.add(spot, spot.target);
    });
    const screenFill = new THREE.SpotLight(0xffe4bd, 140, 32, Math.PI / 4, 0.6, 1.5);
    screenFill.position.set(0, 10, 8);
    screenFill.target.position.set(0, 3, -9);
    this.scene.add(screenFill, screenFill.target);
  }

  buildArchitecture() {
    const m = this.materials;
    const floor = mesh(this.scene, new THREE.PlaneGeometry(29, 37), m.floor, [0, 0, 3], [-Math.PI / 2, 0, 0]);
    floor.receiveShadow = true;
    box(this.scene, [3.15, 0.035, 27], m.carpet, [0, 0.028, 4.6]);
    box(this.scene, [0.055, 0.045, 27], m.gold, [-1.58, 0.04, 4.6]);
    box(this.scene, [0.055, 0.045, 27], m.gold, [1.58, 0.04, 4.6]);
    for (let z = -8; z <= 17; z += 2.5) {
      box(this.scene, [3.0, 0.012, 0.022], m.darkGold, [0, 0.052, z]);
    }
    box(this.scene, [0.5, 14.2, 37], m.wall, [-14.25, 7, 3]);
    box(this.scene, [0.5, 14.2, 37], m.wall, [14.25, 7, 3]);
    box(this.scene, [29, 14.2, 0.5], m.wall, [0, 7, 21.25]);
    box(this.scene, [29, 14.2, 0.6], m.panel, [0, 7, -13.2]);
    box(this.scene, [29, 0.45, 37], m.ceiling, [0, 14.2, 3]);

    // Layered cornices and panel moldings make the walls architectural at every viewpoint.
    [-13.94, 13.94].forEach((x) => {
      [0.3, 5.7, 11.8, 13.7].forEach((y) => box(this.scene, [0.18, 0.13, 36], m.gold, [x, y, 3]));
      for (let z = -9; z <= 16; z += 6.25) {
        box(this.scene, [0.22, 4.5, 0.11], m.gold, [x, 3.05, z - 2.25]);
        box(this.scene, [0.22, 4.5, 0.11], m.gold, [x, 3.05, z + 2.25]);
        box(this.scene, [0.22, 0.1, 4.55], m.gold, [x, 0.8, z]);
        box(this.scene, [0.22, 0.1, 4.55], m.gold, [x, 5.3, z]);
        const panel = box(this.scene, [0.12, 3.9, 3.9], m.panel, [x, 3.05, z]);
        panel.material = m.panel;
      }
    });

    // Repeated fluted pilasters and their carved capitals.
    [-11.8, -4.8, 2.2, 9.2, 16.2].forEach((z) => {
      [-13.65, 13.65].forEach((x) => {
        cylinder(this.scene, [0.3, 0.36, 10.6, 18], m.panel, [x, 5.7, z]);
        cylinder(this.scene, [0.43, 0.43, 0.18, 20], m.gold, [x, 0.55, z]);
        cylinder(this.scene, [0.45, 0.33, 0.28, 20], m.gold, [x, 11.0, z]);
        for (let flute = 0; flute < 6; flute += 1) {
          const angle = (flute / 6) * Math.PI * 2;
          cylinder(this.scene, [0.022, 0.022, 9.4, 6], m.darkGold, [x + Math.cos(angle) * 0.305, 5.65, z + Math.sin(angle) * 0.305]);
        }
      });
    });

    // Ceiling coffers, rosettes, and gilded ribs.
    for (let z = -9; z <= 17; z += 6.5) {
      box(this.scene, [27.5, 0.17, 0.18], m.gold, [0, 13.86, z]);
      const ring = mesh(this.scene, new THREE.TorusGeometry(1.6, 0.07, 8, 48), m.darkGold, [0, 13.75, z + 2.7], [Math.PI / 2, 0, 0]);
      ring.scale.x = 1.7;
    }
    [-9, -3, 3, 9].forEach((x) => box(this.scene, [0.15, 0.17, 35], m.darkGold, [x, 13.87, 3]));
  }

  buildStage() {
    const m = this.materials;
    box(this.scene, [21, 0.65, 5.6], m.wood, [0, 0.33, -9.9]);
    box(this.scene, [20, 0.22, 0.65], m.gold, [0, 0.18, -6.85]);
    box(this.scene, [18.8, 0.2, 0.6], m.wood, [0, 0.1, -6.3]);
    // Velvet curtains assembled as deep folds.
    [-7.65, 7.65].forEach((x, side) => {
      for (let i = 0; i < 7; i += 1) {
        cylinder(this.scene, [0.28, 0.38, 11.2, 12], m.curtains, [x + (side ? 1 : -1) * i * 0.31, 6.25, -12.65 + (i % 2) * 0.08]);
      }
      cylinder(this.scene, [0.5, 0.55, 6.6, 20], m.panel, [side ? 8.15 : -8.15, 4.0, -11.95]);
      cylinder(this.scene, [0.75, 0.52, 0.45, 20], m.gold, [side ? 8.15 : -8.15, 7.42, -11.95]);
    });
    arch(this.scene, 8.15, 5.7, 7.42, -11.95, m.gold, 0.22);
    arch(this.scene, 7.75, 5.25, 7.42, -11.86, m.darkGold, 0.09);
    // Capitals stop beside the screen: no architectural bar may cross its readable content.
    [-1, 1].forEach((side) => box(this.scene, [1.45, 0.16, 0.16], m.gold, [side * 7.45, 7.42, -11.95]));
    // Crown and sunburst above the proscenium.
    const crown = mesh(this.scene, new THREE.TorusGeometry(0.74, 0.08, 8, 40), m.gold, [0, 12.85, -11.83]);
    for (let i = 0; i < 12; i += 1) {
      const angle = (i / 12) * Math.PI * 2;
      const ray = box(this.scene, [0.055, 0.48, 0.06], m.paleGold, [Math.sin(angle) * 1.04, 12.85 + Math.cos(angle) * 1.04, -11.83]);
      ray.rotation.z = -angle;
    }
    mesh(this.scene, sphereGeometry(0.21, 16), m.paleGold, [0, 12.85, -11.75]);

    // Local organ pipes flank the screen rather than competing with it.
    [-1, 1].forEach((side) => {
      for (let i = 0; i < 8; i += 1) {
        const height = 3.3 + Math.sin((i / 7) * Math.PI) * 4.0;
        const x = side * (9.0 + i * 0.45);
        cylinder(this.scene, [0.16, 0.19, height, 14], i % 2 ? m.gold : m.paleGold, [x, 8.8 + height / 2 - 2.1, -12.65]);
        cylinder(this.scene, [0.20, 0.20, 0.12, 14], m.darkGold, [x, 6.65, -12.65]);
        box(this.scene, [0.14, 0.28, 0.03], m.black, [x, 7.25, -12.43]);
      }
    });

    // The giant, explicitly clickable 16:9 projector.
    const slide = this.slides[0];
    this.screenCanvas = createSlideCanvas(slide, 0, this.slides.length, this.slideImages.get(slide.id));
    this.screenTexture = new THREE.CanvasTexture(this.screenCanvas);
    this.screenTexture.colorSpace = THREE.SRGBColorSpace;
    this.screenTexture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    this.screenMaterial = new THREE.MeshBasicMaterial({ map: this.screenTexture, toneMapped: false });
    this.projector = mesh(this.scene, new THREE.PlaneGeometry(12.8, 7.2), this.screenMaterial, [0, 7.8, -12.23]);
    this.projector.userData = { kind: 'projector', label: 'Advance the slide or open the channels' };
    this.interactive.push(this.projector);
    const z = -12.16;
    box(this.scene, [13.18, 0.16, 0.18], m.paleGold, [0, 11.48, z]);
    box(this.scene, [13.18, 0.16, 0.18], m.paleGold, [0, 4.12, z]);
    box(this.scene, [0.16, 7.5, 0.18], m.paleGold, [-6.51, 7.8, z]);
    box(this.scene, [0.16, 7.5, 0.18], m.paleGold, [6.51, 7.8, z]);
    // A slim light underneath makes the screen floating and unmistakably living.
    box(this.scene, [11.8, 0.035, 0.12], m.warmWhite, [0, 4.02, -12.1]);
    this.buildInstruments();
  }

  buildInstruments() {
    const m = this.materials;
    const stageY = 0.72;
    // An intimate semicircle of orchestra chairs and angled music stands.
    const positions = [];
    [-5.2, -3.25, -1.1, 1.1, 3.25, 5.2].forEach((x) => {
      positions.push([x, -5.9 - Math.abs(x) * 0.19]);
      positions.push([x * 0.82, -8.0 - Math.abs(x) * 0.11]);
    });
    positions.forEach(([x, z], index) => {
      box(this.scene, [0.9, 0.16, 0.85], m.seat, [x, stageY + 0.7, z]);
      box(this.scene, [0.9, 1.0, 0.14], m.seatDark, [x, stageY + 1.2, z + 0.36], [-0.08, 0, 0]);
      [-0.34, 0.34].forEach((dx) => cylinder(this.scene, [0.035, 0.035, 0.72, 8], m.gold, [x + dx, stageY + 0.34, z]));
      if (index % 2 === 0) {
        const standZ = z - 0.9;
        cylinder(this.scene, [0.032, 0.04, 1.38, 8], m.black, [x, stageY + 0.86, standZ]);
        const stand = box(this.scene, [1.0, 0.68, 0.055], m.black, [x, stageY + 1.63, standZ], [-0.24, 0, 0]);
        box(stand, [0.84, 0.52, 0.012], m.paper, [0, 0.01, -0.034]);
        for (let staff = 0; staff < 5; staff += 1) box(stand, [0.68, 0.012, 0.008], m.black, [0, 0.16 - staff * 0.06, -0.043]);
      }
    });

    // Cellos / ukuleles use recognisable waisted double bodies, necks, bridges, and strings.
    const stringInstrument = (x, z, scale = 1, rotation = 0) => {
      const group = new THREE.Group();
      group.position.set(x, stageY + 0.15, z);
      group.rotation.z = rotation;
      group.scale.setScalar(scale);
      const lower = mesh(group, sphereGeometry(0.48, 18), m.instrument, [0, 0.64, 0]);
      lower.scale.set(1, 0.85, 0.38);
      const upper = mesh(group, sphereGeometry(0.34, 18), m.instrumentLight, [0, 1.19, 0]);
      upper.scale.set(1, 0.82, 0.35);
      box(group, [0.14, 1.18, 0.12], m.wood, [0, 1.93, 0]);
      box(group, [0.24, 0.34, 0.15], m.instrument, [0, 2.64, 0]);
      box(group, [0.45, 0.08, 0.13], m.ivory, [0, 0.69, -0.18]);
      [-0.045, 0, 0.045].forEach((sx) => box(group, [0.009, 1.85, 0.012], m.string, [sx, 1.55, -0.22]));
      const soundHole = mesh(group, new THREE.TorusGeometry(0.12, 0.022, 8, 20), m.wood, [0, 1.14, -0.135]);
      soundHole.rotation.x = 0;
      this.scene.add(group);
      return group;
    };
    stringInstrument(-4.8, -8.8, 1.0, -0.15);
    stringInstrument(-2.8, -6.9, 0.62, 0.22);
    stringInstrument(2.75, -7.6, 0.72, -0.18);

    // Congas, rims, and a floor tom.
    [4.15, 5.15].forEach((x, i) => {
      cylinder(this.scene, [0.40, 0.30, 1.6 - i * 0.16, 24], m.instrumentLight, [x, stageY + 0.83, -8.55]);
      cylinder(this.scene, [0.43, 0.43, 0.08, 24], m.ivory, [x, stageY + 1.65 - i * 0.08, -8.55]);
      mesh(this.scene, new THREE.TorusGeometry(0.43, 0.025, 8, 28), m.gold, [x, stageY + 1.69 - i * 0.08, -8.55], [Math.PI / 2, 0, 0]);
    });
    // A compact piano silhouette and individually visible ivory keys.
    box(this.scene, [2.4, 1.25, 1.1], m.black, [-6.0, stageY + 0.9, -10.1]);
    box(this.scene, [2.2, 0.08, 0.7], m.ivory, [-6.0, stageY + 1.15, -9.48], [0.12, 0, 0]);
    for (let key = 0; key < 16; key += 1) {
      box(this.scene, [0.025, 0.015, 0.68], m.wood, [-7.02 + key * 0.136, stageY + 1.2, -9.46], [0.12, 0, 0]);
    }
    // Two quiet microphone stands; no audio source exists in this project.
    [-1.0, 1.45].forEach((x) => {
      cylinder(this.scene, [0.028, 0.04, 2.15, 8], m.black, [x, stageY + 1.08, -8.75]);
      cylinder(this.scene, [0.07, 0.07, 0.48, 10], m.black, [x, stageY + 2.23, -8.73], [Math.PI / 2, 0, 0]);
      cylinder(this.scene, [0.42, 0.42, 0.035, 16], m.black, [x, stageY + 0.03, -8.75]);
    });
  }

  buildSeats() {
    const positions = [];
    [2.2, 5.25, 8.3, 11.35, 14.4].forEach((z, row) => {
      [-9.4, -7.5, -5.6, -3.7, 3.7, 5.6, 7.5, 9.4].forEach((x) => positions.push([x, z + Math.abs(x) * 0.035 + row * 0.02]));
    });
    const dummy = new THREE.Object3D();
    const seatMesh = new THREE.InstancedMesh(boxGeometry(1.42, 0.26, 1.28), this.materials.seat, positions.length);
    const backMesh = new THREE.InstancedMesh(boxGeometry(1.42, 1.25, 0.24), this.materials.seatDark, positions.length);
    const legMesh = new THREE.InstancedMesh(boxGeometry(0.07, 0.83, 0.07), this.materials.gold, positions.length * 4);
    positions.forEach(([x, z], index) => {
      dummy.position.set(x, 0.98, z);
      dummy.updateMatrix();
      seatMesh.setMatrixAt(index, dummy.matrix);
      dummy.position.set(x, 1.55, z + 0.58);
      dummy.updateMatrix();
      backMesh.setMatrixAt(index, dummy.matrix);
      let legIndex = index * 4;
      [-0.54, 0.54].forEach((dx) => [-0.42, 0.42].forEach((dz) => {
        dummy.position.set(x + dx, 0.44, z + dz);
        dummy.updateMatrix();
        legMesh.setMatrixAt(legIndex++, dummy.matrix);
      }));
    });
    this.scene.add(seatMesh, backMesh, legMesh);
    // Row-end aisle lamps, warm but not flashing.
    [3.6, 7.0, 10.4, 13.8].forEach((z) => [-2.15, 2.15].forEach((x) => {
      cylinder(this.scene, [0.055, 0.07, 0.7, 10], this.materials.darkGold, [x, 0.36, z]);
      mesh(this.scene, sphereGeometry(0.095, 12), this.materials.warmWhite, [x, 0.77, z]);
    }));
  }

  buildBalconies() {
    const m = this.materials;
    box(this.scene, [27.8, 0.42, 4.0], m.wood, [0, 6.0, 18.7]);
    box(this.scene, [27.2, 0.18, 0.16], m.gold, [0, 7.65, 16.65]);
    box(this.scene, [27.2, 0.14, 0.16], m.gold, [0, 6.48, 16.65]);
    for (let x = -13.2; x <= 13.2; x += 0.72) cylinder(this.scene, [0.035, 0.035, 1.16, 8], m.gold, [x, 7.05, 16.65]);
    [-1, 1].forEach((side) => {
      box(this.scene, [2.5, 0.38, 27], m.wood, [side * 12.65, 6.0, 4.3]);
      box(this.scene, [0.16, 0.18, 27], m.gold, [side * 11.34, 7.65, 4.3]);
      box(this.scene, [0.14, 0.14, 27], m.gold, [side * 11.34, 6.48, 4.3]);
      for (let z = -8.8; z <= 17.6; z += 0.8) cylinder(this.scene, [0.03, 0.03, 1.12, 8], m.gold, [side * 11.34, 7.05, z]);
      // Balcony boxes and velvet fronts.
      for (let z = -7; z < 16; z += 5.3) box(this.scene, [0.35, 0.9, 3.7], m.panel, [side * 13.65, 6.6, z]);
    });
  }

  buildChandeliers() {
    const m = this.materials;
    this.chandeliers = [];
    [-4.3, 6.2, 15.0].forEach((z, chandelierIndex) => {
      const group = new THREE.Group();
      group.position.set(0, 11.9, z);
      cylinder(group, [0.035, 0.035, 1.6, 8], m.gold, [0, 1.0, 0]);
      [1.48, 0.88].forEach((radius, ringIndex) => {
        const y = ringIndex ? 0.48 : 0;
        mesh(group, new THREE.TorusGeometry(radius, 0.055, 8, 48), m.gold, [0, y, 0], [Math.PI / 2, 0, 0]);
        const candles = ringIndex ? 8 : 12;
        for (let i = 0; i < candles; i += 1) {
          const angle = (i / candles) * Math.PI * 2;
          const x = Math.cos(angle) * radius;
          const zz = Math.sin(angle) * radius;
          cylinder(group, [0.035, 0.035, 0.38, 8], m.ivory, [x, y + 0.21, zz]);
          mesh(group, sphereGeometry(0.067, 10), m.warmWhite, [x, y + 0.44, zz]);
        }
      });
      for (let chain = 0; chain < 8; chain += 1) {
        const angle = (chain / 8) * Math.PI * 2;
        lineTube(group, [[0, 1.1, 0], [Math.cos(angle) * 1.48, 0, Math.sin(angle) * 1.48]], 0.018, m.gold);
      }
      const light = new THREE.PointLight(0xffca87, chandelierIndex === 0 ? 46 : 34, 17, 1.8);
      light.position.set(0, -0.2, 0);
      group.add(light);
      this.scene.add(group);
      this.chandeliers.push(group);
    });
  }

  buildVenueDetails() {
    const m = this.materials;
    this.venueGroups = {};
    // Mumbai: sweeping contemporary fan ribs and jewel-like ceiling traces.
    const mumbai = new THREE.Group();
    for (let z = -8; z <= 14; z += 5.5) {
      const points = [];
      for (let i = 0; i <= 24; i += 1) {
        const t = i / 24;
        points.push([-13 + 26 * t, 12.1 + Math.sin(t * Math.PI) * 1.4, z + Math.sin(t * Math.PI * 2) * 0.4]);
      }
      lineTube(mumbai, points, 0.055, m.paleGold);
    }
    [-1, 1].forEach((side) => {
      for (let z = -8; z <= 15; z += 2.2) {
        const jewel = box(mumbai, [0.05, 0.8, 0.8], m.darkGold, [side * 13.79, 10.0, z], [Math.PI / 4, 0, Math.PI / 4]);
        jewel.scale.z = 0.3;
      }
    });
    this.scene.add(mumbai);
    this.venueGroups.mumbai = mumbai;

    // Prague: art-nouveau arches, curling stems, and floral ceiling medallions.
    const prague = new THREE.Group();
    [-1, 1].forEach((side) => {
      for (let z = -6; z <= 13; z += 6.4) {
        const niche = new THREE.Group();
        arch(niche, 2.0, 1.7, 8.3, 0, m.paleGold, 0.065);
        arch(niche, 1.72, 1.4, 8.3, 0.02, m.darkGold, 0.035);
        niche.rotation.y = Math.PI / 2;
        niche.position.set(side * 13.77, 0, z);
        prague.add(niche);
        for (let petal = 0; petal < 8; petal += 1) {
          const angle = (petal / 8) * Math.PI * 2;
          const flower = mesh(prague, sphereGeometry(0.13, 10), m.paleGold, [side * 13.65, 10.9 + Math.sin(angle) * 0.62, z + Math.cos(angle) * 0.62]);
          flower.scale.set(0.45, 1.35, 0.75);
        }
      }
    });
    [0, 7.2].forEach((z) => {
      const oval = mesh(prague, new THREE.TorusGeometry(3.25, 0.085, 8, 64), m.paleGold, [0, 13.69, z], [Math.PI / 2, 0, 0]);
      oval.scale.x = 1.65;
      for (let p = 0; p < 12; p += 1) {
        const angle = (p / 12) * Math.PI * 2;
        const leaf = mesh(prague, sphereGeometry(0.17, 10), m.darkGold, [Math.cos(angle) * 4.0, 13.61, z + Math.sin(angle) * 2.25]);
        leaf.scale.set(2.0, 0.4, 0.75);
        leaf.rotation.y = -angle;
      }
    });
    this.scene.add(prague);
    this.venueGroups.prague = prague;

    // Cannes: geometric bronze fins, a red-carpet emphasis, and restrained premiere lights.
    const cannes = new THREE.Group();
    [-1, 1].forEach((side) => {
      for (let z = -9; z <= 17; z += 1.1) {
        box(cannes, [0.18, 3.0 + ((z + 9) % 3) * 0.38, 0.08], m.darkGold, [side * 13.72, 10.0, z]);
      }
      for (let z = -7; z <= 14; z += 4.2) {
        box(cannes, [0.06, 0.035, 2.7], m.warmWhite, [side * 11.2, 7.86, z]);
      }
    });
    for (let step = 0; step < 4; step += 1) {
      box(cannes, [2.0 + step * 0.6, 0.12, 0.32], m.gold, [-8.8, 1.0 + step * 0.55, -7.4]);
      box(cannes, [2.0 + step * 0.6, 0.12, 0.32], m.gold, [8.8, 1.0 + step * 0.55, -7.4]);
    }
    this.scene.add(cannes);
    this.venueGroups.cannes = cannes;
  }

  buildPhotoWalls() {
    const m = this.materials;
    // The living wall leads with the already-public Devcon 8 Mandala Room photographs, then the Garden Circle history.
    this.historyItems = [...this.garden.map((item) => ({ ...item, kind: 'history', year: 2026, event: item.event || 'Devcon 8 Music Sanctuary · Mumbai' })), ...this.media.filter((item) => item.kind === 'history')];
    this.portraitItems = this.media.filter((item) => item.kind === 'portrait');
    const addFrame = ({ pool, position, rotationY = 0, width = 3.45, height = 2.2, poolIndex = 0 }) => {
      const group = new THREE.Group();
      group.position.set(...position);
      group.rotation.y = rotationY;
      const backing = box(group, [width + 0.26, height + 0.26, 0.12], m.wood, [0, 0, -0.07]);
      backing.userData.decorative = true;
      box(group, [width + 0.36, 0.09, 0.18], m.gold, [0, height / 2 + 0.15, 0]);
      box(group, [width + 0.36, 0.09, 0.18], m.gold, [0, -height / 2 - 0.15, 0]);
      box(group, [0.09, height + 0.38, 0.18], m.gold, [-width / 2 - 0.14, 0, 0]);
      box(group, [0.09, height + 0.38, 0.18], m.gold, [width / 2 + 0.14, 0, 0]);
      const placeholder = createPlaceholderTexture(pool === 'portrait' ? 'Artist in the circle' : 'A living memory');
      const material = new THREE.MeshBasicMaterial({ map: placeholder, toneMapped: false });
      const photo = mesh(group, new THREE.PlaneGeometry(width, height), material, [0, 0, 0.035]);
      photo.userData = {
        kind: 'photo', pool, poolIndex, request: 0,
        label: pool === 'portrait' ? 'Change this artist portrait' : 'Change this living memory'
      };
      // A small museum-style light and title plaque.
      box(group, [width * 0.55, 0.06, 0.12], m.warmWhite, [0, height / 2 + 0.38, 0.1]);
      box(group, [width * 0.45, 0.10, 0.08], m.darkGold, [0, -height / 2 - 0.34, 0.02]);
      this.scene.add(group);
      this.photoFrames.push(photo);
      this.interactive.push(photo);
      return photo;
    };
    [-1, 1].forEach((side) => {
      [-5.6, 0.8, 7.2, 13.6].forEach((z, index) => {
        addFrame({
          pool: 'history', poolIndex: index + (side === 1 ? 4 : 0),
          position: [side * 13.93, 3.1, z], rotationY: side === -1 ? Math.PI / 2 : -Math.PI / 2
        });
      });
      [-2.3, 6.0, 13.5].forEach((z, index) => {
        addFrame({
          pool: 'portrait', poolIndex: index + (side === 1 ? 3 : 0),
          position: [side * 13.91, 9.05, z], rotationY: side === -1 ? Math.PI / 2 : -Math.PI / 2,
          width: 2.1, height: 2.45
        });
      });
    });
    [-7.5, 7.5].forEach((x, index) => addFrame({ pool: 'history', poolIndex: 8 + index, position: [x, 9.25, 20.93], rotationY: Math.PI, width: 4.0, height: 2.55 }));
    this.canvas.dataset.photoFrames = String(this.photoFrames.length);
    this.assignPhotos(0);
  }

  async textureFor(item, frameAspect) {
    const cacheKey = `${item.id}:${frameAspect.toFixed(3)}`;
    if (this.textureCache.has(cacheKey)) return this.textureCache.get(cacheKey);
    const promise = new Promise((resolve, reject) => {
      new THREE.TextureLoader().load(item.src, (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
        const imageAspect = texture.image.width / texture.image.height;
        if (imageAspect > frameAspect) {
          texture.repeat.x = frameAspect / imageAspect;
          texture.offset.x = (1 - texture.repeat.x) / 2;
        } else {
          texture.repeat.y = imageAspect / frameAspect;
          texture.offset.y = (1 - texture.repeat.y) / 2;
        }
        resolve(texture);
      }, undefined, reject);
    });
    this.textureCache.set(cacheKey, promise);
    try {
      return await promise;
    } catch (error) {
      this.textureCache.delete(cacheKey);
      throw error;
    }
  }

  async assignPhoto(frame, item, announce = false) {
    if (!item) return;
    frame.userData.request += 1;
    const request = frame.userData.request;
    try {
      const aspect = frame.geometry.parameters.width / frame.geometry.parameters.height;
      const texture = await this.textureFor(item, aspect);
      if (request !== frame.userData.request) return;
      const oldMap = frame.material.map;
      frame.material.map = texture;
      frame.material.needsUpdate = true;
      frame.userData.itemId = item.id;
      if (oldMap && oldMap.image instanceof HTMLCanvasElement) oldMap.dispose();
      if (announce) {
        this.canvas.dataset.lastPhoto = item.id;
        this.onPhoto?.(item);
      }
    } catch (error) {
      // Keep the intentional local placeholder visible and provide one concise UI warning.
      this.onToast?.('A wall photograph could not be loaded. The rest of the hall is still available.');
      console.warn(`Local photo unavailable: ${item.src}`, error.message);
    }
  }

  assignPhotos(slideIndex) {
    this.photoFrames.forEach((frame, index) => {
      const items = frame.userData.pool === 'portrait' ? this.portraitItems : this.historyItems;
      const stride = frame.userData.pool === 'portrait' ? 3 : 5;
      const itemIndex = (frame.userData.poolIndex + slideIndex * stride + index) % items.length;
      frame.userData.currentIndex = itemIndex;
      this.assignPhoto(frame, items[itemIndex], false);
    });
  }

  advancePhoto(frame) {
    const items = frame.userData.pool === 'portrait' ? this.portraitItems : this.historyItems;
    const next = ((frame.userData.currentIndex ?? 0) + 1) % items.length;
    frame.userData.currentIndex = next;
    this.assignPhoto(frame, items[next], true);
  }

  buildOrchestraPit() {
    // The orchestra pit on the floor: a circle on rugs between the stage apron and the first row, the way the sanctuary sat.
    const m = this.materials;
    const pit = new THREE.Group();
    pit.position.set(0, 0, -3.1);
    const rug = cylinder(pit, [3.6, 3.6, 0.05, 48], m.carpet, [0, 0.03, 0]);
    rug.receiveShadow = true;
    mesh(pit, new THREE.TorusGeometry(3.55, 0.035, 8, 64), m.gold, [0, 0.06, 0], [Math.PI / 2, 0, 0]);
    cylinder(pit, [2.2, 2.2, 0.03, 48], m.curtains, [0, 0.06, 0]);
    mesh(pit, new THREE.TorusGeometry(2.15, 0.028, 8, 56), m.darkGold, [0, 0.08, 0], [Math.PI / 2, 0, 0]);
    // A ring of cane stools and cushions, every seat equal.
    for (let i = 0; i < 12; i += 1) {
      const angle = (i / 12) * Math.PI * 2 + Math.PI / 12;
      const x = Math.cos(angle) * 2.95, z = Math.sin(angle) * 2.95;
      if (i % 3 === 0) {
        const cushion = mesh(pit, sphereGeometry(0.34, 12), i % 2 ? m.seat : m.instrumentLight, [x, 0.16, z]);
        cushion.scale.set(1.15, 0.42, 1.15);
      } else {
        cylinder(pit, [0.3, 0.26, 0.42, 14], m.instrument, [x, 0.21, z]);
        cylinder(pit, [0.31, 0.31, 0.05, 14], m.seatDark, [x, 0.45, z]);
      }
    }
    // Instruments resting in the circle: a djembe, a cajón, a dhol on its side, a small keyboard, ukuleles on a stand.
    cylinder(pit, [0.26, 0.17, 0.62, 18], m.instrumentLight, [1.3, 0.31, 0.9]);
    cylinder(pit, [0.28, 0.28, 0.05, 18], m.ivory, [1.3, 0.64, 0.9]);
    box(pit, [0.38, 0.5, 0.32], m.wood, [-1.4, 0.25, 1.1]);
    cylinder(pit, [0.2, 0.2, 0.012, 24], m.black, [-1.4, 0.26, 1.27], [Math.PI / 2, 0, 0]);
    const dhol = cylinder(pit, [0.26, 0.26, 0.78, 20], m.instrument, [0.2, 0.27, -1.5], [0, 0, Math.PI / 2]);
    dhol.rotation.y = 0.5;
    [-0.4, 0.4].forEach((dx) => cylinder(pit, [0.27, 0.27, 0.04, 20], m.ivory, [0.2 + Math.cos(0.5) * dx, 0.27, -1.5 - Math.sin(0.5) * dx], [0, 0.5, Math.PI / 2]));
    box(pit, [1.3, 0.1, 0.36], m.black, [-0.9, 0.42, -0.9], [0, 0.35, 0]);
    box(pit, [1.16, 0.03, 0.26], m.ivory, [-0.9, 0.48, -0.9], [0, 0.35, 0]);
    [-0.45, 0.45].forEach((dx) => cylinder(pit, [0.03, 0.03, 0.4, 8], m.darkGold, [-0.9 + dx, 0.2, -0.9]));
    const stand = new THREE.Group();
    stand.position.set(1.9, 0, -0.5);
    cylinder(stand, [0.03, 0.03, 1.1, 8], m.darkGold, [0, 0.55, 0]);
    box(stand, [0.9, 0.03, 0.03], m.darkGold, [0, 1.05, 0]);
    [-0.3, 0, 0.3].forEach((dx, i) => {
      const uke = new THREE.Group();
      uke.position.set(dx, 0.38, 0.06);
      uke.scale.setScalar(0.32);
      const lower = mesh(uke, sphereGeometry(0.48, 14), i % 2 ? m.instrument : m.instrumentLight, [0, 0.64, 0]);
      lower.scale.set(1, 0.85, 0.38);
      const upper = mesh(uke, sphereGeometry(0.34, 14), m.instrumentLight, [0, 1.19, 0]);
      upper.scale.set(1, 0.82, 0.35);
      box(uke, [0.14, 1.18, 0.12], m.wood, [0, 1.93, 0]);
      [-0.045, 0, 0.045].forEach((sx) => box(uke, [0.009, 1.85, 0.012], m.string, [sx, 1.55, -0.22]));
      stand.add(uke);
    });
    pit.add(stand);
    // Soft floor lanterns around the circle; warm, never flashing.
    for (let i = 0; i < 6; i += 1) {
      const angle = (i / 6) * Math.PI * 2;
      mesh(pit, sphereGeometry(0.075, 10), m.warmWhite, [Math.cos(angle) * 3.75, 0.1, Math.sin(angle) * 3.75]);
    }
    const glow = new THREE.PointLight(0xffc98a, 18, 9, 1.9);
    glow.position.set(0, 1.4, 0);
    pit.add(glow);
    this.scene.add(pit);
    this.pit = pit;
    this.canvas.dataset.pit = 'floor';
  }

  /** Put a film in the projector: mirror a playing <video> onto the big screen; null restores the slide. */
  setVideo(videoElement) {
    if (videoElement) {
      if (!this.videoTexture || this.videoTexture.image !== videoElement) {
        this.videoTexture?.dispose();
        this.videoTexture = new THREE.VideoTexture(videoElement);
        this.videoTexture.colorSpace = THREE.SRGBColorSpace;
      }
      this.screenMaterial.map = this.videoTexture;
      this.canvas.dataset.projector = 'film';
    } else {
      this.screenMaterial.map = this.screenTexture;
      this.canvas.dataset.projector = 'deck';
    }
    this.screenMaterial.needsUpdate = true;
  }

  setSlide(slide, index) {
    this.slideIndex = index;
    this.canvas.dataset.slide = slide.id;
    const nextCanvas = createSlideCanvas(slide, index, this.slides.length, this.slideImages.get(slide.id));
    this.screenCanvas = nextCanvas;
    this.screenTexture.image = nextCanvas;
    this.screenTexture.needsUpdate = true;
    this.assignPhotos(index);
  }

  setVenue(id) {
    if (!VENUES[id]) return;
    this.venueId = id;
    this.canvas.dataset.hall = id;
    const venue = VENUES[id];
    this.scene.background = new THREE.Color(venue.background);
    this.scene.fog = new THREE.FogExp2(venue.fog, id === 'prague' ? 0.012 : 0.015);
    this.materials.wall.color.setHex(venue.wall);
    this.materials.panel.color.setHex(venue.panel);
    this.materials.ceiling.color.setHex(venue.ceiling);
    this.materials.gold.color.setHex(venue.gold);
    this.materials.floor.color.setHex(venue.floor);
    this.materials.carpet.color.setHex(venue.carpet);
    this.materials.seat.color.setHex(venue.seat);
    this.materials.curtains.color.setHex(venue.curtains);
    this.hemisphere.color.setHex(venue.light);
    this.renderer.toneMappingExposure = venue.exposure;
    Object.entries(this.venueGroups).forEach(([key, group]) => { group.visible = key === id; });
  }

  setupXR() {
    const status = document.getElementById('vr-status');
    if ('xr' in navigator && window.isSecureContext) {
      this.renderer.xr.enabled = true;
      this.renderer.xr.setReferenceSpaceType('local-floor');
      const button = VRButton.createButton(this.renderer, { optionalFeatures: ['local-floor'] });
      button.title = 'On a supported headset, enter VR. Controller select advances the slide.';
      const syncButtonA11y = () => {
        const capable = /^(ENTER VR|EXIT VR)$/.test(button.textContent.trim());
        button.setAttribute('aria-label', capable
          ? (button.textContent.trim() === 'ENTER VR' ? 'Enter the immersive WebXR orchestra hall' : 'Leave immersive VR')
          : button.textContent.trim());
        button.setAttribute('aria-disabled', String(!capable));
        button.tabIndex = capable ? 0 : -1;
      };
      new MutationObserver(syncButtonA11y).observe(button, { childList: true, subtree: true, characterData: true });
      syncButtonA11y();
      this.vrHost.appendChild(button);
      status.hidden = true;
      for (let i = 0; i < 2; i += 1) {
        const controller = this.renderer.xr.getController(i);
        controller.addEventListener('select', () => this.onNext?.());
        const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
        const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0xe7c983 }));
        line.scale.z = 4;
        controller.add(line);
        this.scene.add(controller);
      }
      this.renderer.xr.addEventListener('sessionstart', () => {
        this.desktopCamera = { position: this.camera.position.clone(), yaw: this.yaw, pitch: this.pitch };
        this.camera.position.set(0, 0.05, 8);
        this.onToast?.('VR session started. Use controller select for the next movement.');
      });
      this.renderer.xr.addEventListener('sessionend', () => {
        if (this.desktopCamera) {
          this.camera.position.copy(this.desktopCamera.position);
          this.yaw = this.desktopCamera.yaw;
          this.pitch = this.desktopCamera.pitch;
        }
      });
    } else {
      status.hidden = false;
      status.textContent = window.isSecureContext ? 'VR not detected' : 'VR needs HTTPS';
      status.title = 'Enter VR appears here on capable WebXR devices.';
    }
  }

  setupInteraction() {
    this.onPointerDown = (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      this.canvas.focus({ preventScroll: true });
      this.canvas.setPointerCapture(event.pointerId);
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY });
      this.dragged = false;
      this.userNavigated = true;
      if (this.pointers.size === 2) this.lastPinch = this.pointerDistance();
    };
    this.onPointerMove = (event) => {
      if (!this.pointers.has(event.pointerId)) {
        this.updateHover(event);
        return;
      }
      const previous = this.pointers.get(event.pointerId);
      const dx = event.clientX - previous.x;
      const dy = event.clientY - previous.y;
      this.pointers.set(event.pointerId, { ...previous, x: event.clientX, y: event.clientY });
      if (this.pointers.size === 2) {
        const distance = this.pointerDistance();
        if (this.lastPinch) this.dolly((distance - this.lastPinch) * 0.025);
        this.lastPinch = distance;
        this.dragged = true;
      } else {
        if (Math.hypot(event.clientX - previous.startX, event.clientY - previous.startY) > 5) this.dragged = true;
        this.yaw -= dx * 0.0032;
        this.pitch = clamp(this.pitch + dy * 0.0028, -0.78, 0.88);
      }
    };
    this.onPointerUp = (event) => {
      const pointer = this.pointers.get(event.pointerId);
      const wasSingle = this.pointers.size === 1;
      this.pointers.delete(event.pointerId);
      if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
      if (pointer && wasSingle && !this.dragged) this.activateAt(event);
      if (this.pointers.size < 2) this.lastPinch = 0;
    };
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('pointercancel', this.onPointerUp);
    this.canvas.addEventListener('pointerleave', () => this.clearHover());
    this.canvas.addEventListener('wheel', (event) => {
      event.preventDefault();
      this.userNavigated = true;
      this.dolly(-event.deltaY * 0.0075);
    }, { passive: false });
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('keydown', (event) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
      const key = event.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'q', 'e', 'shift'].includes(key)) this.keys.add(key);
    });
    document.addEventListener('keyup', (event) => this.keys.delete(event.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
  }

  pointerDistance() {
    const points = [...this.pointers.values()];
    return points.length === 2 ? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) : 0;
  }

  setRayFromEvent(event) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointerNdc.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
  }

  hitAt(event) {
    this.setRayFromEvent(event);
    return this.raycaster.intersectObjects(this.interactive, false)[0]?.object || null;
  }

  activateAt(event) {
    const hit = this.hitAt(event);
    if (!hit) return;
    if (hit.userData.kind === 'projector') { if (this.canvas.dataset.projector === 'film' && this.onProjectorFilm) this.onProjectorFilm(); else this.onNext?.(); }
    if (hit.userData.kind === 'photo') this.advancePhoto(hit);
  }

  updateHover(event) {
    const hit = this.hitAt(event);
    this.canvas.style.cursor = hit ? 'pointer' : 'grab';
    this.canvas.dataset.hoverTarget = hit?.userData.kind || '';
    const hint = document.getElementById('object-hint');
    if (hit) {
      hint.textContent = hit.userData.kind === 'projector' ? (this.canvas.dataset.projector === 'film' ? 'Open the channels 📺' : 'Next movement →') : 'Change this living frame ↻';
      hint.style.left = `${event.clientX + 14}px`;
      hint.style.top = `${event.clientY + 14}px`;
      hint.hidden = false;
    } else hint.hidden = true;
  }

  clearHover() {
    const hint = document.getElementById('object-hint');
    if (hint) hint.hidden = true;
    if (this.canvas) this.canvas.dataset.hoverTarget = '';
  }

  direction() {
    return new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch)).normalize();
  }

  dolly(amount) {
    this.camera.position.addScaledVector(this.direction(), amount);
    this.constrainCamera();
  }

  setMove(key, pressed) {
    const normalized = ({ forward: 'w', back: 's', left: 'a', right: 'd', up: 'e', down: 'q' })[key] || key;
    if (pressed) {
      this.keys.add(normalized);
      this.userNavigated = true;
    } else this.keys.delete(normalized);
  }

  constrainCamera() {
    this.camera.position.x = clamp(this.camera.position.x, -12.8, 12.8);
    this.camera.position.y = clamp(this.camera.position.y, 1.65, 12.8);
    this.camera.position.z = clamp(this.camera.position.z, -10.7, 20.1);
  }

  resetCamera(markNavigation = true) {
    if (markNavigation) this.userNavigated = false;
    const portrait = this.container.clientWidth / Math.max(1, this.container.clientHeight) < 0.85;
    if (portrait) {
      this.camera.position.set(0, 5.2, 18.2);
      this.camera.fov = 56;
      this.pitch = 0.075;
    } else {
      this.camera.position.set(0, 4.6, 7.5);
      this.camera.fov = 48;
      this.pitch = 0.102;
    }
    this.yaw = 0;
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(this.camera.position.clone().add(this.direction()));
  }

  focusProjector() {
    this.userNavigated = true;
    this.camera.position.set(0, 6.4, this.container.clientWidth < 700 ? 11.5 : 2.5);
    this.yaw = 0;
    this.pitch = Math.atan2(7.6 - this.camera.position.y, Math.abs(-12.23 - this.camera.position.z));
  }

  resize() {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  render() {
    const delta = Math.min(this.clock.getDelta(), 0.05);
    if (this.keys.size && !this.renderer.xr.isPresenting) {
      const speed = (this.keys.has('shift') ? 8.0 : 4.0) * delta;
      const forward = new THREE.Vector3(Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      const right = new THREE.Vector3(Math.cos(this.yaw), 0, Math.sin(this.yaw));
      if (this.keys.has('w')) this.camera.position.addScaledVector(forward, speed);
      if (this.keys.has('s')) this.camera.position.addScaledVector(forward, -speed);
      if (this.keys.has('d')) this.camera.position.addScaledVector(right, speed);
      if (this.keys.has('a')) this.camera.position.addScaledVector(right, -speed);
      if (this.keys.has('e')) this.camera.position.y += speed;
      if (this.keys.has('q')) this.camera.position.y -= speed;
      this.constrainCamera();
    }
    if (!this.renderer.xr.isPresenting) this.camera.lookAt(this.camera.position.clone().add(this.direction()));
    if (!this.reducedMotion()) {
      this.chandeliers.forEach((chandelier, index) => {
        chandelier.rotation.y = Math.sin(this.clock.elapsedTime * 0.09 + index) * 0.035;
      });
    }
    this.renderer.render(this.scene, this.camera);
  }
}

export const HALL_VENUES = Object.freeze({
  mumbai: 'Memory gold · Mumbai memory lighting',
  prague: 'Art Nouveau ivory · Prague-inspired lighting',
  cannes: 'Premiere night · Cannes-inspired lighting'
});
