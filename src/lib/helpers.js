import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const D2R = Math.PI / 180;
export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

export const mat = (color, o = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.1, ...o });
export const sphere = (r, color, o) => new THREE.Mesh(new THREE.SphereGeometry(r, 32, 16), mat(color, o));
export const box = (w, h, d, color, o) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, o));

/** Blue (0) → cyan → green → yellow → red (1). */
export function heat(t, out = new THREE.Color()) {
  return out.setHSL(0.66 * (1 - clamp(t, 0, 1)), 0.9, 0.55);
}

export function floorGrid(size = 20, div = 20, y = 0) {
  const g = new THREE.GridHelper(size, div, 0x3a5a80, 0x1c2a3c);
  g.position.y = y;
  g.material.transparent = true;
  g.material.opacity = 0.6;
  return g;
}

// ---------- Arrows ----------
const _d = new THREE.Vector3();
export function makeArrow(color, len = 1) {
  return new THREE.ArrowHelper(V(1, 0, 0), V(), len, color, 0.25, 0.15);
}
/** Point arrow `a` from `origin` along `vec`, length = |vec| * scale. */
export function setArrow(a, origin, vec, scale = 1) {
  const len = vec.length() * scale;
  a.position.copy(origin);
  if (len < 1e-3) { a.visible = false; return; }
  a.visible = true;
  a.setDirection(_d.copy(vec).normalize());
  const head = Math.min(0.3, len * 0.35);
  a.setLength(len, head, head * 0.6);
}

/** Many arrows in one draw call. */
const UP = V(0, 1, 0), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _m = new THREE.Matrix4(), _c = new THREE.Color();
export class ArrowField {
  constructor(max, radius = 0.025) {
    const shaft = new THREE.CylinderGeometry(radius, radius, 0.72, 6);
    shaft.translate(0, 0.36, 0);
    const head = new THREE.ConeGeometry(radius * 2.8, 0.28, 10);
    head.translate(0, 0.86, 0);
    const geo = mergeGeometries([shaft, head]);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.5 }), max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.max = max;
  }
  set(i, origin, dir, length, color, width = 1) {
    if (i >= this.max) return;
    _q.setFromUnitVectors(UP, _d.copy(dir).normalize());
    _s.set(width, Math.max(length, 1e-4), width);
    _m.compose(origin, _q, _s);
    this.mesh.setMatrixAt(i, _m);
    this.mesh.setColorAt(i, color.isColor ? color : _c.set(color));
  }
  commit(n) {
    this.mesh.count = Math.min(n, this.max);
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

// ---------- Lines ----------
/** Growing polyline (oldest points drop off once full). */
export class Trail {
  constructor(max = 1000, color = 0xffffff, opacity = 1) {
    this.max = max; this.count = 0;
    this.pos = new Float32Array(max * 3);
    this.geo = new THREE.BufferGeometry();
    this.attr = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('position', this.attr);
    this.geo.setDrawRange(0, 0);
    this.line = new THREE.Line(this.geo, new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity }));
    this.line.frustumCulled = false;
  }
  push(v) {
    if (this.count >= this.max) { this.pos.copyWithin(0, 3); this.count = this.max - 1; }
    const k = this.count * 3;
    this.pos[k] = v.x; this.pos[k + 1] = v.y; this.pos[k + 2] = v.z;
    this.count++;
    this.geo.setDrawRange(0, this.count);
    this.attr.needsUpdate = true;
  }
  clear() { this.count = 0; this.geo.setDrawRange(0, 0); }
}

/** Fixed-length polyline you rewrite each frame. */
export class Curve {
  constructor(n, color = 0xffffff, opacity = 1) {
    this.n = n;
    this.pos = new Float32Array(n * 3);
    this.geo = new THREE.BufferGeometry();
    this.attr = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('position', this.attr);
    this.line = new THREE.Line(this.geo, new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity }));
    this.line.frustumCulled = false;
  }
  set(i, x, y, z) { const k = i * 3; this.pos[k] = x; this.pos[k + 1] = y; this.pos[k + 2] = z; }
  update() { this.attr.needsUpdate = true; }
}

// ---------- Text ----------
export function textSprite(text, { height = 0.35, color = '#e8f0ff', weight = 600 } = {}) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const font = `${weight} 48px system-ui, -apple-system, sans-serif`;
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 24;
  c.width = w; c.height = 64;
  ctx.font = font; ctx.fillStyle = color; ctx.textBaseline = 'middle';
  ctx.fillText(text, 12, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set((height * w) / 64, height, 1);
  return s;
}

export function fibonacciSphere(n) {
  const out = [];
  const g = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n;
    const r = Math.sqrt(1 - y * y);
    out.push(V(Math.cos(g * i) * r, y, Math.sin(g * i) * r));
  }
  return out;
}

export function disposeObject(o) {
  o.traverse((c) => {
    c.geometry?.dispose();
    const m = c.material;
    if (m) (Array.isArray(m) ? m : [m]).forEach((mm) => { mm.map?.dispose(); mm.dispose(); });
  });
}

export const fmt = (x, d = 2) => (x >= 0 ? ' ' : '') + x.toFixed(d);
