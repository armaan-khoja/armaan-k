import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import gsap from 'gsap';
import { TYPES } from './projects.js';

const VOID = '#0E1016';
const GOLD = '#F5A623';
const CARD_W = 1.6;
const CARD_H = 2.24;
const TAU = Math.PI * 2;
const BLOOM = 0.42;
const IDLE_LIGHT = 1.1;
const LID_OPEN = -1.78;

function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function faceGeometry(w, h, r) {
  const g = new THREE.ShapeGeometry(roundedRect(w, h, r), 8);
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) + w / 2) / w, (pos.getY(i) + h / 2) / h);
  }
  return g;
}

function canvasTexture(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const radialTexture = (inner, outer) => canvasTexture(256, (ctx, s) => {
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
});

// A soft ring for the shockwave that runs across the floor when the lid pops.
const ringTexture = () => canvasTexture(256, (ctx, s) => {
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.6, 'rgba(255,255,255,0)');
  g.addColorStop(0.84, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
});

// Soft rays behind the presented card.
const haloTexture = () => canvasTexture(512, (ctx, s) => {
  const m = s / 2;
  ctx.translate(m, m);
  const rays = 16;
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * TAU;
    const w = i % 2 ? 0.035 : 0.07;
    const g = ctx.createRadialGradient(0, 0, m * 0.1, 0, 0, m);
    g.addColorStop(0, 'rgba(255,255,255,0.5)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, m, a - w, a + w);
    ctx.closePath();
    ctx.fill();
  }
  const core = ctx.createRadialGradient(0, 0, 0, 0, 0, m * 0.75);
  core.addColorStop(0, 'rgba(255,255,255,0.8)');
  core.addColorStop(0.4, 'rgba(255,255,255,0.25)');
  core.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = core;
  ctx.fillRect(-m, -m, s, s);
});

// Foil mask for the card back: its gold frame catches the light.
function frameMask() {
  const c = document.createElement('canvas');
  c.width = 384;
  c.height = 538;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.roundRect(0, 0, 384, 538, 22); ctx.fill();
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.roundRect(12, 12, 360, 514, 15); ctx.fill();
  return new THREE.CanvasTexture(c);
}

/* ---------- Shaders ---------- */

// The card face: a printed card under one key light. The art keeps its authored
// color; only the foil (frame and big number) shifts hue with the viewing angle.
const CARD_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vUv = uv;
    vN = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vV = mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;
const CARD_FRAG = /* glsl */ `
  uniform sampler2D uMap;
  uniform sampler2D uFoil;
  uniform vec3 uTint;
  uniform float uFlash;
  uniform float uSheen;
  uniform float uGain;
  uniform float uSweep;
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vV;

  // gold, lime, aqua, sky: a foil ramp that never passes through pink
  vec3 foilRamp(float t) {
    t = fract(t) * 4.0;
    vec3 a = vec3(1.0, 0.74, 0.28);
    vec3 b = vec3(0.62, 1.0, 0.42);
    vec3 c = vec3(0.3, 0.95, 0.9);
    vec3 d = vec3(0.38, 0.62, 1.0);
    if (t < 1.0) return mix(a, b, t);
    if (t < 2.0) return mix(b, c, t - 1.0);
    if (t < 3.0) return mix(c, d, t - 2.0);
    return mix(d, a, t - 3.0);
  }

  void main() {
    vec3 base = texture2D(uMap, vUv).rgb;
    float foil = texture2D(uFoil, vUv).r;
    vec3 N = normalize(vN);
    vec3 V = normalize(-vV);
    vec3 L = normalize(vec3(-0.45, 0.6, 0.66));
    float ndl = max(dot(N, L), 0.0);
    float key = 0.8 + 0.16 * ndl;
    float fall = mix(1.0, 0.9, clamp(vUv.x * 0.45 + (1.0 - vUv.y) * 0.55, 0.0, 1.0));
    vec3 col = base * key * fall;

    float tilt = N.x * 1.7 + N.y * 1.2;
    vec3 rainbow = foilRamp(vUv.x * 0.7 + vUv.y * 0.5 + tilt * 0.8);
    vec3 foilCol = mix(uTint, rainbow, 0.5);
    // the glint rests just off the top corner and slides in as the card tilts;
    // uSweep runs a slow shine across the foil every few seconds
    float d = vUv.x * 0.8 + vUv.y * 0.6;
    float band = d - 1.5 + tilt * 0.9;
    float glint = exp(-band * band / 0.012);
    float sb = d - mix(-0.3, 1.7, uSweep);
    glint += step(0.0, uSweep) * exp(-sb * sb / 0.008) * 0.9;
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.0), 80.0);
    col = mix(col, col * 0.7 + foilCol * 0.4, foil * 0.45 * uSheen);
    col += foil * foilCol * (glint * 0.6 + spec * 0.4) * uSheen;
    col += glint * 0.035 * uSheen;
    col = mix(col, uTint * (1.5 * uGain) + 0.45, uFlash);
    gl_FragColor = vec4(col, 1.0);
  }
`;

const BEAM_VERT = /* glsl */ `
  varying vec2 vUv;
  varying float vFacing;
  void main() {
    vUv = uv;
    vec3 n = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vFacing = abs(dot(n, normalize(-mv.xyz)));
    gl_Position = projectionMatrix * mv;
  }
`;
const BEAM_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uOpacity;
  varying vec2 vUv;
  varying float vFacing;
  void main() {
    float y = clamp(vUv.y, 0.0, 1.0);
    float fade = pow(1.0 - y, 1.8) * smoothstep(0.0, 0.04, y);
    float streak = 0.62 + 0.38 * sin(vUv.x * 6.2831 * 7.0 + uTime * 0.9) * sin(vUv.x * 6.2831 * 3.0 - uTime * 0.6);
    float soft = clamp(vFacing, 0.0, 1.0);
    soft *= soft;
    gl_FragColor = vec4(uColor * 1.5, fade * streak * soft * uOpacity);
  }
`;

// The floor fades into the void, so there is no horizon line.
const FLOOR_VERT = /* glsl */ `
  varying vec3 vW;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
const FLOOR_FRAG = /* glsl */ `
  uniform vec3 uFloor;
  uniform vec3 uVoid;
  varying vec3 vW;
  void main() {
    float r = length(vW.xz * vec2(1.0, 1.25));
    float k = smoothstep(0.8, 8.5, r);
    gl_FragColor = vec4(mix(uFloor, uVoid, k), 1.0);
  }
`;

const POINT_VERT = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  uniform float uScale;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vColor = aColor;
    vAlpha = aAlpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;
const POINT_FRAG = /* glsl */ `
  uniform float uBoost;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = 1.0 - smoothstep(0.0, 0.5, d);
    gl_FragColor = vec4(vColor * uBoost, a * a * vAlpha);
  }
`;
const pointMaterial = (boost) => new THREE.ShaderMaterial({
  uniforms: { uScale: { value: 200 }, uBoost: { value: boost } },
  vertexShader: POINT_VERT,
  fragmentShader: POINT_FRAG,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});

/* ---------- Particles: one pool for sparks and dust ---------- */

class Particles {
  constructor(count) {
    this.count = count;
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(count * 3);
    this.col = new Float32Array(count * 3);
    this.size = new Float32Array(count);
    this.alpha = new Float32Array(count);
    this.vel = new Float32Array(count * 3);
    this.life = new Float32Array(count);
    this.maxLife = new Float32Array(count);
    this.drag = new Float32Array(count);
    this.grav = new Float32Array(count);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    this.geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    this.mat = pointMaterial(2.6);
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.cursor = 0;
    this.live = 0;
  }
  emit({ at, color, n, speed = 4, spread = 1, up = 1, size = [0.05, 0.13], life = [0.6, 1.4], gravity = 5, drag = 1.6, jitter = 0.6 }) {
    const c = new THREE.Color(color);
    for (let k = 0; k < n; k++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.count;
      const a = Math.random() * TAU;
      const s = speed * (0.35 + Math.random() * 0.65);
      this.pos[i * 3] = at.x + (Math.random() - 0.5) * jitter;
      this.pos[i * 3 + 1] = at.y + Math.random() * 0.15;
      this.pos[i * 3 + 2] = at.z + (Math.random() - 0.5) * jitter * 0.6;
      this.vel[i * 3] = Math.cos(a) * s * spread;
      this.vel[i * 3 + 1] = s * up * (0.6 + Math.random());
      this.vel[i * 3 + 2] = Math.sin(a) * s * spread;
      this.col[i * 3] = c.r; this.col[i * 3 + 1] = c.g; this.col[i * 3 + 2] = c.b;
      this.size[i] = size[0] + Math.random() * (size[1] - size[0]);
      this.maxLife[i] = this.life[i] = life[0] + Math.random() * (life[1] - life[0]);
      this.grav[i] = gravity;
      this.drag[i] = drag;
    }
    this.live = Math.max(this.live, life[1]);
    this.geo.attributes.aColor.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
  }
  update(dt) {
    if (this.live <= 0) return;
    this.live -= dt;
    for (let i = 0; i < this.count; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.life[i] -= dt;
      const k = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i * 3] *= k; this.vel[i * 3 + 2] *= k;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * k - this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] = Math.max(0.02, this.pos[i * 3 + 1] + this.vel[i * 3 + 1] * dt);
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const t = this.life[i] / this.maxLife[i];
      this.alpha[i] = Math.min(1, t * 2.2);
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aAlpha.needsUpdate = true;
  }
}

/* ---------- The stage ---------- */

export function createStage(canvas, { art, back, reduced = false, onChestClick, stowTarget }) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  } catch {
    return null;
  }
  const coarse = matchMedia('(pointer: coarse)').matches;
  const pr = Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2);
  renderer.setPixelRatio(pr);
  // Neutral keeps printed colors (card art, gold, the void) at their authored values.
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(VOID);
  // A dark studio for reflections: one warm key panel front-left, one cool rim panel
  // back-right, nothing overhead (so upward faces stay dark instead of glowing).
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(new THREE.BoxGeometry(20, 20, 20), new THREE.MeshBasicMaterial({ color: '#0B0D13', side: THREE.BackSide })));
  const panel = (w, h, color, k, pos) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    envScene.add(m);
  };
  panel(7, 5, '#FFE6C4', 3.2, [-6, 4, 6]);
  panel(5, 7, '#6AA8FF', 2.2, [7, 2, -5]);
  panel(10, 3, '#C8D4F0', 0.9, [0, 1.5, 9]);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envMap = pmrem.fromScene(envScene, 0.02).texture;

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 80);
  scene.add(camera); // the presented card rides on the camera

  // Multisampled target: the composer path would otherwise drop antialiasing.
  // 2x MSAA is enough on dense screens and costs half as much as 4x.
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: coarse || pr >= 2 ? 2 : 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(pr);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), BLOOM, 0.45, 1.0);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  /* lights */
  scene.add(new THREE.HemisphereLight('#8a9cc8', '#0b0c10', 0.45));
  const key = new THREE.DirectionalLight('#ffe6c4', 2.4);
  key.position.set(-4, 7, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight('#6aa8ff', 2.0);
  rim.position.set(5, 3, -6);
  scene.add(rim);
  const chestLight = new THREE.PointLight(GOLD, IDLE_LIGHT, 7, 2);
  chestLight.position.set(0, 1.6, 0.3);
  scene.add(chestLight);

  /* floor, contact shadow, light pool, shockwave */
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.ShaderMaterial({
      uniforms: { uFloor: { value: new THREE.Color('#1A1F2B') }, uVoid: { value: new THREE.Color(VOID) } },
      vertexShader: FLOOR_VERT,
      fragmentShader: FLOOR_FRAG,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const flatOnFloor = (m, y) => { m.rotation.x = -Math.PI / 2; m.position.y = y; scene.add(m); return m; };
  const shadow = flatOnFloor(new THREE.Mesh(
    new THREE.PlaneGeometry(4.4, 3.0),
    new THREE.MeshBasicMaterial({ map: radialTexture('rgba(0,0,0,0.9)', 'rgba(0,0,0,0)'), transparent: true, depthWrite: false }),
  ), 0.01);
  const pool = flatOnFloor(new THREE.Mesh(
    new THREE.PlaneGeometry(5.2, 5.2),
    new THREE.MeshBasicMaterial({ map: radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: GOLD, opacity: 0 }),
  ), 0.02);
  const ring = flatOnFloor(new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.MeshBasicMaterial({ map: ringTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }),
  ), 0.03);

  /* the chest: rig > chest (drop, turn, rattle) > squash (squash and stretch) > body (breathing) */
  const steel = new THREE.MeshStandardMaterial({ color: '#3A4458', metalness: 0.4, roughness: 0.44, envMap, envMapIntensity: 1.0 });
  const gold = new THREE.MeshStandardMaterial({ color: '#EBA53C', metalness: 1, roughness: 0.32, envMap, envMapIntensity: 1.0 });
  const dark = new THREE.MeshStandardMaterial({ color: '#07080C', roughness: 0.9, envMap, envMapIntensity: 0.2 });
  const lining = new THREE.MeshStandardMaterial({ color: '#0E131C', metalness: 0.2, roughness: 0.8, envMap, envMapIntensity: 0.1 });
  const seamMat = new THREE.MeshBasicMaterial({ color: GOLD });
  const innerMat = new THREE.MeshBasicMaterial({ map: radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });

  const rig = new THREE.Group();
  scene.add(rig);
  const chest = new THREE.Group();
  rig.add(chest);
  const squash = new THREE.Group();
  chest.add(squash);
  const body = new THREE.Group();
  squash.add(body);
  const add = (geo, mat, x, y, z, parent = body) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  add(new RoundedBoxGeometry(2.4, 1.2, 1.5, 4, 0.1), steel, 0, 0.6, 0);
  add(new RoundedBoxGeometry(2.5, 0.16, 1.6, 2, 0.05), gold, 0, 0.08, 0);
  add(new RoundedBoxGeometry(2.48, 0.1, 1.58, 2, 0.04), gold, 0, 1.17, 0);
  for (const x of [-0.8, 0.8]) {
    add(new RoundedBoxGeometry(0.22, 1.22, 1.56, 2, 0.05), gold, x, 0.6, 0);
    for (const y of [0.35, 0.6, 0.85]) {
      add(new THREE.SphereGeometry(0.035, 12, 8), gold, x + 0.17, y, 0.785);
      add(new THREE.SphereGeometry(0.035, 12, 8), gold, x - 0.17, y, 0.785);
    }
  }
  for (const [x, z] of [[-1.18, -0.73], [1.18, -0.73], [-1.18, 0.73], [1.18, 0.73]]) {
    add(new RoundedBoxGeometry(0.16, 1.24, 0.16, 2, 0.05), gold, x, 0.6, z);
  }
  // the seam that leaks light, and the dark interior with its glow (seen once the lid opens)
  add(new THREE.BoxGeometry(2.34, 0.05, 1.46), seamMat, 0, 1.235, 0);
  const interior = add(new THREE.PlaneGeometry(2.24, 1.36), dark, 0, 1.262, 0);
  interior.rotation.x = -Math.PI / 2;
  const innerGlow = add(new THREE.PlaneGeometry(2.3, 1.5), innerMat, 0, 1.266, 0);
  innerGlow.rotation.x = -Math.PI / 2;
  const mouth = new THREE.Object3D(); // where the card leaves from
  mouth.position.set(0, 1.1, 0);
  body.add(mouth);

  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, 1.27, -0.75);
  body.add(lidPivot);
  const lidShape = new THREE.Shape();
  lidShape.absellipse(0, 0, 0.75, 0.52, 0, Math.PI, false);
  lidShape.lineTo(0.75, 0);
  const lidGeo = new THREE.ExtrudeGeometry(lidShape, { depth: 2.4, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.025, bevelSegments: 3, curveSegments: 28 });
  lidGeo.translate(0, 0, -1.2);
  lidGeo.rotateY(Math.PI / 2);
  add(toCreasedNormals(lidGeo, 0.7), steel, 0, 0, 0.75, lidPivot);
  const underside = add(new THREE.PlaneGeometry(2.44, 1.52), lining, 0, -0.026, 0.75, lidPivot);
  underside.rotation.x = Math.PI / 2;
  const bandShape = new THREE.Shape();
  bandShape.absellipse(0, 0, 0.82, 0.59, 0, Math.PI, false);
  bandShape.lineTo(0.82, 0);
  const hole = new THREE.Path();
  hole.absellipse(0, 0, 0.74, 0.51, 0, Math.PI, false);
  hole.lineTo(0.74, 0);
  bandShape.holes.push(hole);
  for (const x of [-0.8, 0.8]) {
    const g = new THREE.ExtrudeGeometry(bandShape, { depth: 0.22, bevelEnabled: false, curveSegments: 28 });
    g.translate(0, 0, -0.11);
    g.rotateY(Math.PI / 2);
    add(toCreasedNormals(g, 0.7), gold, x, 0, 0.75, lidPivot);
  }
  add(new RoundedBoxGeometry(0.44, 0.5, 0.1, 2, 0.04), gold, 0, 0.98, 0.78);
  add(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 16), dark, 0, 1.02, 0.84).rotation.x = Math.PI / 2;
  add(new THREE.BoxGeometry(0.04, 0.1, 0.04), dark, 0, 0.94, 0.84);
  chest.traverse((o) => { if (o.isMesh) o.userData.chest = true; });

  /* the beam */
  const beamMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(GOLD) }, uTime: { value: 0 }, uOpacity: { value: 0 } },
    vertexShader: BEAM_VERT,
    fragmentShader: BEAM_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const beamGeo = new THREE.CylinderGeometry(1.0, 0.62, 9, 48, 1, true);
  beamGeo.translate(0, 4.5, 0);
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.position.y = 1.2;
  beam.scale.set(1, 0.001, 1);
  beam.visible = false;
  chest.add(beam);

  /* particles */
  const sparks = new Particles(coarse ? 240 : 400);
  scene.add(sparks.points);
  const MOTES = coarse ? 60 : 120;
  const moteGeo = new THREE.BufferGeometry();
  const motePos = new Float32Array(MOTES * 3);
  const moteSeed = new Float32Array(MOTES);
  const moteCol = new Float32Array(MOTES * 3);
  for (let i = 0; i < MOTES; i++) {
    motePos[i * 3] = (Math.random() - 0.5) * 16;
    motePos[i * 3 + 1] = Math.random() * 8;
    motePos[i * 3 + 2] = (Math.random() - 0.5) * 9 - 1.5;
    moteSeed[i] = Math.random() * 100;
    moteCol.set([1, 0.72, 0.32], i * 3);
  }
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  moteGeo.setAttribute('aColor', new THREE.BufferAttribute(moteCol, 3));
  moteGeo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(MOTES).map(() => 0.03 + Math.random() * 0.04), 1));
  moteGeo.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(MOTES).map(() => 0.2 + Math.random() * 0.45), 1));
  const moteMat = pointMaterial(0.9);
  const motes = new THREE.Points(moteGeo, moteMat);
  motes.frustumCulled = false;
  scene.add(motes);

  /* the card */
  const tint = new THREE.Color(GOLD);
  const gain = { value: 1 };
  const sweep = { value: -1 };
  const flash = { value: 0 };
  const sheen = { value: 1 };
  const makeTex = (canvasEl, srgb = true) => {
    const t = new THREE.CanvasTexture(canvasEl);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return t;
  };
  const textures = {};
  for (const [id, a] of Object.entries(art)) textures[id] = { front: makeTex(a.front), foil: makeTex(a.foil, false) };
  const cardMaterial = (map, foil) => new THREE.ShaderMaterial({
    uniforms: { uMap: { value: map }, uFoil: { value: foil }, uTint: { value: tint }, uFlash: flash, uSheen: sheen, uGain: gain, uSweep: sweep },
    vertexShader: CARD_VERT,
    fragmentShader: CARD_FRAG,
  });
  const firstId = Object.keys(textures)[0];
  const frontMat = cardMaterial(textures[firstId].front, textures[firstId].foil);
  const backMat = cardMaterial(makeTex(back), frameMask());
  const edgeMat = new THREE.MeshStandardMaterial({ color: GOLD, metalness: 0.85, roughness: 0.35, envMap, envMapIntensity: 1.0 });

  const cardRig = new THREE.Group();
  const cardSpin = new THREE.Group();
  cardRig.add(cardSpin);
  cardRig.visible = false;
  camera.add(cardRig);
  const front = new THREE.Mesh(faceGeometry(CARD_W, CARD_H, 0.12), frontMat);
  front.position.z = 0.017;
  const backFace = new THREE.Mesh(faceGeometry(CARD_W, CARD_H, 0.12), backMat);
  backFace.rotation.y = Math.PI;
  backFace.position.z = -0.017;
  const edge = new THREE.Mesh(
    new THREE.ExtrudeGeometry(roundedRect(CARD_W, CARD_H, 0.12), { depth: 0.032, bevelEnabled: false, curveSegments: 8 }),
    edgeMat,
  );
  edge.position.z = -0.016;
  cardSpin.add(front, backFace, edge);
  cardSpin.traverse((o) => { if (o.isMesh) o.userData.card = true; });
  const halo = new THREE.Mesh(
    new THREE.PlaneGeometry(CARD_H * 2.0, CARD_H * 2.0),
    new THREE.MeshBasicMaterial({ map: haloTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }),
  );
  halo.position.z = -0.6;
  cardRig.add(halo);

  /* animated state (GSAP writes these, the loop reads them) */
  let mode = 'idle'; // intro | idle | opening | shown | stowing
  const glowColor = new THREE.Color(GOLD);
  const typeColor = new THREE.Color(GOLD);
  const goldColor = new THREE.Color(GOLD);
  const fx = { seam: 1, inner: 0, light: IDLE_LIGHT, pool: 0.025, strain: 0 };
  const colorK = { value: 0 }; // 0 gold, 1 the platform color
  const lid = { x: 0 };
  const view = { k: 0, push: 0 };
  const fl = { p: 0, spin: 0, punch: 1, interact: 0 };
  const st = { q: 0, flip: 0, roll: 0, punch: 1 };
  const stowFrom = { pos: new THREE.Vector3(), scale: 1, spin: 0, tiltX: 0, to: new THREE.Vector3(), endScale: 0.06 };
  let openTl = null;
  let stowTl = null;
  let shake = 0;
  let idleT = 0.8;
  let shineT = 2.6;
  let dtLast = 0;

  /* layout */
  let portrait = false;
  const camIdle = new THREE.Vector3();
  const lookIdle = new THREE.Vector3();
  const camPresent = new THREE.Vector3();
  const lookPresent = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  const WHITE = new THREE.Color(1, 1, 1);
  function frame() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    portrait = w / h < 0.9;
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const tanH = tanV * camera.aspect;
    const needW = portrait ? 4.3 : 7;
    const dist = Math.max((needW / 2) / tanH, portrait ? 12.5 : 9);
    camIdle.set(0, 2.3 + dist * 0.1, dist);
    lookIdle.set(0, portrait ? 2.2 : 1.15, 0);
    // Presenting: same camera angle, moved so the open chest sits right under the card.
    const fwd = lookIdle.clone().sub(camIdle).normalize();
    const right = new THREE.Vector3().crossVectors(fwd, UP).normalize();
    const up = new THREE.Vector3().crossVectors(right, fwd);
    const D = dist * (portrait ? 1.25 : 1.5);
    const nx = portrait ? 0 : -0.38;
    const ny = portrait ? -0.12 : -0.62;
    camPresent.set(0, 0.75, 0)
      .addScaledVector(fwd, -D)
      .addScaledVector(right, -nx * D * tanH)
      .addScaledVector(up, -ny * D * tanV);
    lookPresent.copy(camPresent).addScaledVector(fwd, 10);
    sparks.mat.uniforms.uScale.value = h * pr * 0.5;
    moteMat.uniforms.uScale.value = h * pr * 0.5;
  }

  // where the card floats, in camera space; returns its share of the view height
  function cardLocal(out) {
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const frac = portrait ? 0.36 : 0.58;
    const d = CARD_H / (frac * 2 * tanV);
    const hv = 2 * d * tanV;
    const wv = hv * camera.aspect;
    if (portrait) out.set(0, hv * 0.185, -d);
    else out.set(-wv * 0.19, hv * 0.03, -d);
    return frac;
  }

  // the HUD counter, in camera space at the card's depth; returns the landing scale
  function counterLocal(out) {
    const r = stowTarget?.();
    const c = canvas.getBoundingClientRect();
    const target = new THREE.Vector3();
    const frac = cardLocal(target);
    const d = -target.z;
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const tanH = tanV * camera.aspect;
    let nx = 0.85, ny = 0.9, px = 22;
    if (r && r.width) {
      nx = ((r.left + r.width / 2 - c.left) / c.width) * 2 - 1;
      ny = -(((r.top + r.height / 2 - c.top) / c.height) * 2 - 1);
      px = r.height;
    }
    out.set(nx * d * tanH, ny * d * tanV, -d);
    return (px * 1.3) / (frac * c.height);
  }

  function setType(project) {
    typeColor.set(TYPES[project.type].color);
    const lum = 0.2126 * typeColor.r + 0.7152 * typeColor.g + 0.0722 * typeColor.b;
    gain.value = THREE.MathUtils.clamp(0.42 / lum, 0.55, 1.4);
    tint.copy(typeColor);
    beamMat.uniforms.uColor.value.copy(typeColor).multiplyScalar(gain.value);
    ring.material.color.copy(typeColor).multiplyScalar(gain.value);
    halo.material.color.copy(typeColor).multiplyScalar(0.8 * gain.value);
    edgeMat.color.copy(typeColor);
    const tex = textures[project.id];
    frontMat.uniforms.uMap.value = tex.front;
    frontMat.uniforms.uFoil.value = tex.foil;
  }

  function killMotion() {
    openTl?.kill();
    stowTl?.kill();
    openTl = stowTl = null;
    gsap.killTweensOf([lid, fx, view, fl, st, glowColor, colorK, beam.scale, beamMat.uniforms.uOpacity, halo.material, halo.scale, ring.scale, ring.material, squash.scale, flash, bloom]);
  }

  function hideCard() {
    cardRig.visible = false;
    sweep.value = -1;
    halo.material.opacity = 0;
    fl.interact = 0;
    drag.spin = 0; drag.vel = 0; drag.active = false;
  }

  function closeLid(delay = 0, camDelay = delay) {
    const k = reduced ? 0.02 : 1;
    gsap.to(lid, { x: 0, duration: 0.5 * k, ease: reduced ? 'none' : 'bounce.out', delay, overwrite: true });
    gsap.to(beam.scale, { y: 0.001, duration: 0.3 * k, ease: 'power2.in', delay, overwrite: true });
    gsap.to(beamMat.uniforms.uOpacity, { value: 0, duration: 0.3 * k, delay, overwrite: true, onComplete: () => { beam.visible = false; } });
    gsap.to(fx, { light: IDLE_LIGHT, inner: 0, seam: 1, pool: 0.025, duration: 0.5 * k, delay, overwrite: true });
    gsap.to(view, { k: 0, push: 0, duration: 0.8 * k, ease: 'power2.inOut', delay: camDelay, overwrite: true });
    gsap.to(glowColor, { r: goldColor.r, g: goldColor.g, b: goldColor.b, duration: 0.6 * k, delay: delay + 0.2 * k, overwrite: true });
    gsap.to(colorK, { value: 0, duration: 0.6 * k, delay: delay + 0.2 * k, overwrite: true });
    if (!reduced) {
      // the lid lands: a small thud
      gsap.delayedCall(delay + 0.18, () => {
        if (mode === 'opening') return;
        shake = Math.max(shake, 0.035);
        gsap.fromTo(squash.scale, { x: 1.03, y: 0.95, z: 1.03 }, { x: 1, y: 1, z: 1, duration: 0.45, ease: 'power3.out', overwrite: true });
      });
    }
  }

  function burst() {
    shake = 0.14;
    const at = new THREE.Vector3(0, 1.25, 0).applyMatrix4(chest.matrixWorld);
    sparks.emit({ at, color: typeColor, n: coarse ? 80 : 120, speed: 5.2, up: 1.5, size: [0.05, 0.13] });
    sparks.emit({ at, color: GOLD, n: coarse ? 36 : 56, speed: 3.2, up: 1.9, size: [0.035, 0.08], life: [1, 1.9] });
  }

  function open(project) {
    killMotion();
    mode = 'opening';
    setType(project);
    fl.p = 0; fl.spin = Math.PI * 3; fl.punch = 1; fl.interact = 0;
    drag.spin = 0; drag.vel = 0;

    return new Promise((resolve) => {
      if (reduced) {
        glowColor.copy(typeColor);
        colorK.value = 1;
        beam.visible = true;
        lid.x = LID_OPEN;
        beam.scale.set(1, 1, 1);
        beamMat.uniforms.uOpacity.value = 0.16;
        Object.assign(fx, { light: 2.6, inner: 1.6, seam: 1.2, pool: 0.13, strain: 0 });
        view.k = 1;
        fl.p = 1; fl.spin = 0; fl.interact = 1;
        halo.material.opacity = 0.055;
        halo.scale.setScalar(1);
        cardRig.visible = true;
        gsap.fromTo(fl, { punch: 0.96 }, { punch: 1, duration: 0.25, ease: 'power2.out' });
        gsap.fromTo(flash, { value: 0.45 }, { value: 0, duration: 0.3 });
        mode = 'shown';
        resolve();
        return;
      }
      const tl = gsap.timeline({ onComplete: () => { mode = 'shown'; openTl = null; } });
      openTl = tl;
      // anticipation: the lid strains and the light inside turns the platform's color
      tl.to(glowColor, { r: typeColor.r, g: typeColor.g, b: typeColor.b, duration: 0.3, ease: 'power1.out' }, 0);
      tl.to(colorK, { value: 1, duration: 0.3, ease: 'power1.out' }, 0);
      tl.to(fx, { strain: 1, seam: 3.2, light: 3.5, duration: 0.5, ease: 'power2.in' }, 0);
      tl.to(squash.scale, { x: 1.06, y: 0.9, z: 1.06, duration: 0.5, ease: 'power2.in' }, 0);
      tl.to(view, { push: 1, duration: 0.5, ease: 'power2.in' }, 0);
      // pop
      tl.add('pop', 0.5);
      tl.set(fx, { strain: 0 }, 'pop');
      tl.to(squash.scale, { x: 0.95, y: 1.1, z: 0.95, duration: 0.1, ease: 'power3.out' }, 'pop');
      tl.to(squash.scale, { x: 1, y: 1, z: 1, duration: 0.8, ease: 'elastic.out(1, 0.45)' }, 'pop+=0.1');
      tl.to(lid, { x: LID_OPEN, duration: 0.55, ease: 'back.out(1.6)' }, 'pop');
      tl.to(fx, { light: 10, inner: 5, seam: 1.4, pool: 0.35, duration: 0.06, ease: 'none' }, 'pop');
      tl.to(fx, { light: 2.6, inner: 1.6, pool: 0.13, duration: 1.3, ease: 'power2.out' }, 'pop+=0.06');
      tl.to(bloom, { strength: 1.15, duration: 0.05 }, 'pop');
      tl.to(bloom, { strength: BLOOM, duration: 0.7, ease: 'power2.out' }, 'pop+=0.05');
      tl.fromTo(beam.scale, { x: 1.3, y: 0.001, z: 1.3 }, { y: 1, duration: 0.5, ease: 'expo.out', immediateRender: false }, 'pop');
      tl.to(beam.scale, { x: 1, z: 1, duration: 0.9, ease: 'power2.out' }, 'pop');
      tl.fromTo(beamMat.uniforms.uOpacity, { value: 1 }, { value: 0.4, duration: 0.7, ease: 'power2.out', immediateRender: false }, 'pop');
      tl.to(beamMat.uniforms.uOpacity, { value: 0.14, duration: 1.6, ease: 'sine.inOut' }, 'pop+=0.7');
      tl.fromTo(ring.scale, { x: 0.8, y: 0.8, z: 0.8 }, { x: 3.8, y: 3.8, z: 3.8, duration: 0.7, ease: 'power2.out', immediateRender: false }, 'pop');
      tl.fromTo(ring.material, { opacity: 0.45 }, { opacity: 0, duration: 0.7, ease: 'power1.in', immediateRender: false }, 'pop');
      tl.call(() => { beam.visible = true; burst(); }, null, 'pop');
      tl.to(view, { k: 1, push: 0, duration: 1.1, ease: 'power2.inOut' }, 'pop+=0.05');
      // the card flies out on an arc, spins a turn and a half and faces you
      tl.call(() => { cardRig.visible = true; }, null, 'pop+=0.04');
      tl.to(fl, { p: 1, duration: 1.0, ease: 'power3.out' }, 'pop+=0.04');
      tl.to(fl, { spin: -0.16, duration: 0.95, ease: 'power2.out' }, 'pop+=0.04');
      tl.to(fl, { spin: 0, duration: 0.45, ease: 'sine.inOut' }, 'pop+=0.99');
      tl.fromTo(flash, { value: 1 }, { value: 0, duration: 0.4, ease: 'power1.in', immediateRender: false }, 'pop+=0.04');
      // it lands: a small punch, the halo flares, then everything calms down
      tl.to(fl, { punch: 1.045, duration: 0.14, ease: 'power2.out' }, 'pop+=0.62');
      tl.to(fl, { punch: 1, duration: 0.5, ease: 'power2.inOut' }, 'pop+=0.76');
      tl.fromTo(halo.material, { opacity: 0 }, { opacity: 0.6, duration: 0.14, ease: 'power2.out', immediateRender: false }, 'pop+=0.6');
      tl.to(halo.material, { opacity: 0.055, duration: 1.4, ease: 'power2.out' }, 'pop+=0.74');
      tl.fromTo(halo.scale, { x: 0.5, y: 0.5, z: 0.5 }, { x: 1, y: 1, z: 1, duration: 0.9, ease: 'expo.out', immediateRender: false }, 'pop+=0.6');
      tl.to(fl, { interact: 1, duration: 0.6, ease: 'power1.inOut' }, 'pop+=0.9');
      tl.call(resolve, null, 'pop+=0.62');
    });
  }

  function stow() {
    if (mode !== 'shown' && mode !== 'opening') {
      closeLid();
      return Promise.resolve();
    }
    killMotion();
    mode = 'stowing';
    sweep.value = -1;
    stowFrom.pos.copy(cardRig.position);
    stowFrom.scale = cardRig.scale.x;
    stowFrom.spin = cardSpin.rotation.y - Math.round(cardSpin.rotation.y / TAU) * TAU;
    stowFrom.tiltX = cardSpin.rotation.x;
    stowFrom.endScale = counterLocal(stowFrom.to);
    st.q = 0; st.flip = 0; st.roll = 0; st.punch = 1;
    return new Promise((resolve) => {
      if (reduced) {
        hideCard();
        closeLid();
        mode = 'idle';
        resolve();
        return;
      }
      const tl = gsap.timeline();
      stowTl = tl;
      tl.to(st, { punch: 1.05, duration: 0.1, ease: 'power2.out' }, 0);
      tl.to(st, { punch: 1, duration: 0.3, ease: 'power2.in' }, 0.1);
      tl.to(st, { q: 1, duration: 0.5, ease: 'power2.in' }, 0.05);
      tl.to(st, { flip: Math.PI, duration: 0.34, ease: 'power2.inOut' }, 0.05);
      tl.to(st, { roll: -0.3, duration: 0.5, ease: 'power1.in' }, 0.05);
      tl.to(halo.material, { opacity: 0, duration: 0.2, ease: 'power2.in' }, 0);
      tl.call(() => {
        hideCard();
        mode = 'idle';
        idleT = 0.8;
        stowTl = null;
        resolve();
      }, null, 0.55);
      closeLid(0.05, 0.3);
    });
  }

  // Put everything away at once (the visitor scrolled off with a card out).
  function stowNow() {
    killMotion();
    hideCard();
    lid.x = 0;
    beam.scale.set(1, 0.001, 1);
    beam.visible = false;
    beamMat.uniforms.uOpacity.value = 0;
    Object.assign(fx, { seam: 1, inner: 0, light: IDLE_LIGHT, pool: 0.025, strain: 0 });
    colorK.value = 0;
    view.k = 0; view.push = 0;
    glowColor.copy(goldColor);
    squash.scale.set(1, 1, 1);
    bloom.strength = BLOOM;
    mode = 'idle';
  }

  function intro() {
    if (reduced) { mode = 'idle'; return 0; }
    mode = 'intro';
    chest.position.y = 6;
    const tl = gsap.timeline({ delay: 0.2, onComplete: () => { mode = 'idle'; idleT = 0.8; } });
    tl.to(chest.position, { y: 0, duration: 0.52, ease: 'power2.in' });
    tl.fromTo(squash.scale, { x: 0.94, y: 1.08, z: 0.94 }, { x: 0.97, y: 1.04, z: 0.97, duration: 0.52, ease: 'none' }, 0);
    tl.fromTo(shadow.scale, { x: 0.35, y: 0.35 }, { x: 1, y: 1, duration: 0.52, ease: 'power2.in' }, 0);
    tl.fromTo(shadow.material, { opacity: 0.15 }, { opacity: 1, duration: 0.52, ease: 'power2.in' }, 0);
    tl.fromTo(fx, { pool: 0 }, { pool: 0.025, duration: 0.52, ease: 'power2.in' }, 0);
    tl.add('land');
    tl.call(() => {
      shake = 0.1;
      sparks.emit({ at: new THREE.Vector3(0, 0.04, 0.2), color: '#2C3445', n: 44, speed: 3.2, up: 0.3, spread: 1.5, size: [0.14, 0.3], life: [0.5, 1.1], gravity: 0.4, drag: 3.2, jitter: 2.2 });
    }, null, 'land');
    tl.to(squash.scale, { x: 1.1, y: 0.84, z: 1.1, duration: 0.07, ease: 'power2.out' }, 'land');
    tl.to(squash.scale, { x: 1, y: 1, z: 1, duration: 0.75, ease: 'elastic.out(1, 0.4)' }, 'land+=0.07');
    tl.to(lid, { x: -0.28, duration: 0.11, ease: 'power2.out' }, 'land');
    tl.to(lid, { x: 0, duration: 0.5, ease: 'bounce.out' }, 'land+=0.11');
    tl.fromTo(fx, { seam: 2.4 }, { seam: 1, duration: 0.8, ease: 'power2.out', immediateRender: false }, 'land');
    return 0.72; // seconds until the chest lands
  }

  /* pointer: chest hover, card tilt and drag-to-spin */
  const pointer = new THREE.Vector2(0, 0);
  const pointerSmooth = new THREE.Vector2(0, 0);
  const drag = { active: false, lastX: 0, lastT: 0, vel: 0, spin: 0 };
  let hover = false;
  let hoverK = 0;
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const canDrag = () => mode === 'shown' || (mode === 'opening' && fl.interact > 0.3);
  function hit(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    camera.updateMatrixWorld();
    ray.setFromCamera(ndc, camera);
    const targets = cardRig.visible ? [chest, cardSpin] : [chest];
    return ray.intersectObjects(targets, true)[0]?.object.userData || {};
  }
  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    if (e.pointerType !== 'touch') pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    if (drag.active) {
      const dx = e.clientX - drag.lastX;
      const dts = Math.max(0.008, (e.timeStamp - drag.lastT) / 1000);
      drag.lastX = e.clientX;
      drag.lastT = e.timeStamp;
      drag.spin += dx * 0.012;
      drag.vel = drag.vel * 0.5 + ((dx * 0.012) / dts) * 0.5;
      return;
    }
    if (e.pointerType === 'touch') return;
    const h = hit(e);
    hover = !!h.chest && mode === 'idle';
    canvas.style.cursor = hover ? 'pointer' : h.card && canDrag() ? 'grab' : '';
  });
  canvas.addEventListener('pointerdown', (e) => {
    if (!canDrag()) return;
    if (hit(e).card) {
      drag.active = true;
      drag.lastX = e.clientX;
      drag.lastT = e.timeStamp;
      drag.vel = 0;
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = 'grabbing';
    }
  });
  const endDrag = () => {
    if (!drag.active) return;
    drag.active = false;
    canvas.style.cursor = '';
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('click', (e) => {
    if (mode !== 'idle') return;
    if (hit(e).chest) onChestClick?.();
  });
  canvas.addEventListener('pointerleave', () => { pointer.set(0, 0); hover = false; });

  /* loop */
  const timer = new THREE.Timer();
  const S = new THREE.Vector3();
  const T = new THREE.Vector3();
  const M = new THREE.Vector3();
  const flatQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  const startQ = new THREE.Quaternion();
  const IDENT = new THREE.Quaternion();
  const camPos = new THREE.Vector3();
  const lookPos = new THREE.Vector3();
  const bez = (a, b, c, p, out) => {
    const q = 1 - p;
    return out.set(
      q * q * a.x + 2 * q * p * b.x + p * p * c.x,
      q * q * a.y + 2 * q * p * b.y + p * p * c.y,
      q * q * a.z + 2 * q * p * b.z + p * p * c.z,
    );
  };

  function poseCard(t) {
    if (!cardRig.visible) return;
    if (mode === 'stowing') {
      M.copy(stowFrom.pos).lerp(stowFrom.to, 0.2);
      M.y = Math.max(stowFrom.pos.y, stowFrom.to.y) + CARD_H * 0.25;
      bez(stowFrom.pos, M, stowFrom.to, st.q, cardRig.position);
      cardRig.quaternion.identity();
      cardRig.scale.setScalar((stowFrom.scale + (stowFrom.endScale - stowFrom.scale) * st.q) * st.punch);
      cardSpin.rotation.set(stowFrom.tiltX * (1 - st.q), stowFrom.spin + st.flip, st.roll);
      cardSpin.position.y = 0;
      return;
    }
    // the flight from the chest's mouth to its spot in front of the camera
    cardLocal(T);
    mouth.getWorldPosition(S);
    camera.worldToLocal(S);
    M.copy(S).lerp(T, 0.5);
    M.y = Math.max(S.y, T.y) + CARD_H * (portrait ? 0.7 : 0.9);
    bez(S, M, T, fl.p, cardRig.position);
    startQ.copy(camera.quaternion).invert().multiply(flatQ);
    cardRig.quaternion.slerpQuaternions(startQ, IDENT, Math.min(1, fl.p * 1.5));
    cardRig.scale.setScalar((0.26 + 0.74 * fl.p) * fl.punch);
    const k = fl.interact;
    const tiltOK = !reduced && !coarse;
    cardSpin.rotation.y = fl.spin + drag.spin + (tiltOK ? pointerSmooth.x * 0.32 * k : 0);
    cardSpin.rotation.x = tiltOK ? -pointerSmooth.y * 0.22 * k : 0;
    cardSpin.rotation.z = 0;
    cardSpin.position.y = reduced ? 0 : Math.sin(t * 1.5) * 0.02 * k;
    halo.rotation.z = t * 0.06;
    // a slow shine crosses the foil every 4.5s once the card has settled
    if (!reduced && k > 0.99) {
      shineT += dtLast;
      const c = shineT % 4.5;
      sweep.value = c < 1.1 ? THREE.MathUtils.smootherstep(c / 1.1, 0, 1) : -1;
    } else {
      shineT = 2.6;
      sweep.value = -1;
    }
  }

  function tick(now) {
    if (!running) return;
    requestAnimationFrame(tick);
    timer.update(now);
    const dt = Math.min(timer.getDelta(), 0.05);
    dtLast = dt;
    const t = timer.getElapsed();
    pointerSmooth.lerp(pointer, 1 - Math.exp(-dt * 4));
    hoverK += ((hover && mode === 'idle' ? 1 : 0) - hoverK) * (1 - Math.exp(-dt * 8));

    // camera: framing blend, a slight push during anticipation, pointer parallax, impact shake
    shake *= Math.exp(-dt * 8);
    camPos.lerpVectors(camIdle, camPresent, view.k);
    lookPos.lerpVectors(lookIdle, lookPresent, view.k);
    camPos.lerp(lookPos, view.push * 0.035);
    camera.position.copy(camPos);
    if (!reduced && !coarse) {
      camera.position.x += pointerSmooth.x * 0.3;
      camera.position.y += pointerSmooth.y * 0.16;
    }
    if (shake > 0.001) {
      camera.position.x += (Math.random() - 0.5) * shake;
      camera.position.y += (Math.random() - 0.5) * shake;
    }
    camera.lookAt(lookPos);
    camera.updateMatrixWorld();

    // chest: breathing, the idle peek, the hover rattle and the strain before the pop
    let peek = 0;
    let rattle = 0;
    if (!reduced) {
      if (mode === 'idle') {
        idleT += dt;
        const cyc = idleT % 4.2;
        peek = cyc < 0.8 ? Math.sin((cyc / 0.8) * Math.PI) ** 2 : 0;
        chest.rotation.y += (pointerSmooth.x * 0.22 - chest.rotation.y) * (1 - Math.exp(-dt * 3));
      } else {
        chest.rotation.y += (0 - chest.rotation.y) * (1 - Math.exp(-dt * 4));
      }
      const breath = Math.sin(t * 1.8);
      body.scale.set(1 - breath * 0.004, 1 + breath * 0.008, 1 - breath * 0.004);
      rattle = hoverK * Math.abs(Math.sin(t * 17)) * 0.03;
      const s = fx.strain;
      chest.rotation.z = Math.sin(t * 52) * 0.035 * s * s + Math.sin(t * 21) * 0.005 * hoverK;
      rattle += Math.abs(Math.sin(t * 36)) * 0.09 * s;
    }
    lidPivot.rotation.x = lid.x - peek * (0.06 + 0.08 * hoverK) - rattle;
    const g = THREE.MathUtils.lerp(1, gain.value, colorK.value);
    seamMat.color.copy(glowColor).multiplyScalar(2.3 * g * (fx.seam + peek * 0.8 + hoverK * 0.4));
    innerMat.color.copy(glowColor).multiplyScalar(fx.inner * g);
    innerGlow.visible = fx.inner > 0.01;
    chestLight.color.copy(glowColor);
    chestLight.intensity = (fx.light + peek * 2.2 + hoverK * 0.8) * g;
    pool.material.color.copy(glowColor).lerp(WHITE, 0.3);
    pool.material.opacity = (fx.pool + peek * 0.04) * g;

    // a dragged card settles on the nearest face-up turn with a soft spring
    if (!drag.active && (drag.spin !== 0 || drag.vel !== 0)) {
      const target = Math.round((drag.spin + drag.vel * 0.2) / TAU) * TAU;
      drag.vel += (40 * (target - drag.spin) - 10 * drag.vel) * dt;
      drag.spin += drag.vel * dt;
      if (Math.abs(target - drag.spin) < 0.0005 && Math.abs(drag.vel) < 0.001) { drag.spin = 0; drag.vel = 0; }
    }
    poseCard(t);

    if (!reduced) {
      const mp = moteGeo.attributes.position;
      for (let i = 0; i < MOTES; i++) {
        let y = mp.array[i * 3 + 1] + dt * (0.1 + (moteSeed[i] % 1) * 0.18);
        if (y > 8) y = 0;
        mp.array[i * 3 + 1] = y;
        mp.array[i * 3] += Math.sin(t * 0.5 + moteSeed[i]) * dt * 0.05;
      }
      mp.needsUpdate = true;
    }
    beamMat.uniforms.uTime.value = t;
    sparks.update(dt);
    composer.render();
  }

  let running = false;
  let visible = true;
  function setRunning(on) {
    if (on === running) return;
    running = on;
    if (on) { timer.reset(); requestAnimationFrame(tick); }
  }
  const hidden = () => document.hidden;
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; setRunning(visible && !hidden()); });
  io.observe(canvas);
  document.addEventListener('visibilitychange', () => setRunning(visible && !hidden()));
  new ResizeObserver(frame).observe(canvas);
  frame();
  setRunning(true);

  return {
    open,
    stow,
    stowNow,
    intro,
    get mode() { return mode; },
    get cardShown() { return cardRig.visible; },
  };
}
