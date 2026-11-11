// Wavefunctions for the Atoms & Molecules lessons, and a sampler that turns |ψ|² into an
// electron cloud. Everything here is in "physics" coordinates with z up and lengths in Bohr radii
// (a₀ = 0.529 Å); toScene() maps a point to three.js coordinates (y up).
import * as THREE from 'three';

const fact = (n) => { let f = 1; for (let i = 2; i <= n; i++) f *= i; return f; };

/** Associated Laguerre polynomial L_k^a(x), by recurrence. */
function laguerre(k, a, x) {
  if (k === 0) return 1;
  let l0 = 1, l1 = 1 + a - x;
  for (let i = 1; i < k; i++) {
    const l2 = ((2 * i + 1 + a - x) * l1 - (i + a) * l0) / (i + 1);
    l0 = l1; l1 = l2;
  }
  return l1;
}

/** Associated Legendre P_l^m(x) for m ≥ 0, without the Condon–Shortley phase. */
function legendre(l, m, x) {
  let pmm = 1;
  if (m > 0) {
    const s = Math.sqrt(Math.max(0, 1 - x * x));
    let f = 1;
    for (let i = 1; i <= m; i++) { pmm *= f * s; f += 2; }
  }
  if (l === m) return pmm;
  let pm1 = x * (2 * m + 1) * pmm;
  if (l === m + 1) return pm1;
  let pl = 0;
  for (let ll = m + 2; ll <= l; ll++) {
    pl = ((2 * ll - 1) * x * pm1 - (ll + m - 1) * pmm) / (ll - m);
    pmm = pm1; pm1 = pl;
  }
  return pl;
}

/**
 * Hydrogen-like orbital ψ_nlm for nuclear charge Z. Returns a function (x, y, z) → amplitude.
 * `real: true` gives the chemist's real orbitals (m > 0 → cos mφ, m < 0 → sin |m|φ); otherwise the
 * returned value is the magnitude part R(r)·Θ(θ) of the complex orbital, whose phase is m·φ.
 */
export function hydrogenOrbital(n, l, m, { Z = 1, real = true } = {}) {
  const am = Math.abs(m);
  const nr = Math.sqrt(((2 * Z) / n) ** 3 * fact(n - l - 1) / (2 * n * fact(n + l)));
  const ny = Math.sqrt(((2 * l + 1) / (4 * Math.PI)) * (fact(l - am) / fact(l + am)));
  const k = n - l - 1, a = 2 * l + 1;
  return (x, y, z) => {
    const r = Math.sqrt(x * x + y * y + z * z);
    const rho = (2 * Z * r) / n;
    const R = nr * Math.exp(-rho / 2) * rho ** l * laguerre(k, a, rho);
    const ct = r > 1e-9 ? z / r : 1;
    let Y = ny * legendre(l, am, ct);
    if (real && m !== 0) {
      const phi = Math.atan2(y, x);
      Y *= Math.SQRT2 * (m > 0 ? Math.cos(am * phi) : Math.sin(am * phi));
    }
    return R * Y;
  };
}

/** Box half-size (a₀) that holds essentially all of a hydrogen orbital with quantum number n. */
export const hydrogenExtent = (n, Z = 1) => (2.2 * n * n + 5 * n) / Z;

const REAL_NAMES = {
  '0,0': 's',
  '1,0': 'p_z', '1,1': 'p_x', '1,-1': 'p_y',
  '2,0': 'd_z²', '2,1': 'd_xz', '2,-1': 'd_yz', '2,2': 'd_x²−y²', '2,-2': 'd_xy',
  '3,0': 'f_z³', '3,1': 'f_xz²', '3,-1': 'f_yz²', '3,2': 'f_z(x²−y²)', '3,-2': 'f_xyz', '3,3': 'f_x(x²−3y²)', '3,-3': 'f_y(3x²−y²)',
};
export const orbitalName = (n, l, m, real = true) =>
  real ? `${n}${REAL_NAMES[`${l},${m}`] ?? 'spdf'[l]}` : `${n}${'spdf'[l]}  (m = ${m})`;

// ───────── Slater-type orbitals: nodeless shapes used for bonding sketches ─────────
/** 1s Slater orbital centred at c = [x, y, z]. */
export function sto1s(c, zeta = 1) {
  const N = Math.sqrt(zeta ** 3 / Math.PI);
  return (x, y, z) => N * Math.exp(-zeta * Math.hypot(x - c[0], y - c[1], z - c[2]));
}
/** 2s Slater orbital (r·e^{-ζr}). */
export function sto2s(c, zeta) {
  const N = Math.sqrt(zeta ** 5 / (3 * Math.PI));
  return (x, y, z) => { const r = Math.hypot(x - c[0], y - c[1], z - c[2]); return N * r * Math.exp(-zeta * r); };
}
/** 2p Slater orbital pointing along unit vector d. */
export function sto2p(c, zeta, d) {
  const N = Math.sqrt(zeta ** 5 / Math.PI);
  return (x, y, z) => {
    const dx = x - c[0], dy = y - c[1], dz = z - c[2];
    return N * (dx * d[0] + dy * d[1] + dz * d[2]) * Math.exp(-zeta * Math.hypot(dx, dy, dz));
  };
}
/** sp^λ hybrid pointing along d: (s + √λ·p_d) / √(1+λ). λ = 1, 2, 3 for sp, sp², sp³. */
export function hybrid(c, zeta, d, lambda) {
  const s = sto2s(c, zeta), p = sto2p(c, zeta, d);
  const a = 1 / Math.sqrt(1 + lambda), b = Math.sqrt(lambda) * a;
  return (x, y, z) => a * s(x, y, z) + b * p(x, y, z);
}
export const sum = (...fs) => (x, y, z) => { let v = 0; for (const f of fs) v += f(x, y, z); return v; };
export const diff = (f, g) => (x, y, z) => f(x, y, z) - g(x, y, z);

export const norm3 = (v) => { const n = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / n, v[1] / n, v[2] / n]; };

// ───────── Sampling |ψ|² ─────────
/**
 * Tabulates |ψ|² on a grid inside the box [min, max] and returns a sampler. Each draw picks a cell
 * with probability ∝ |ψ|²·volume and a random spot inside it, so the dots land where the electron
 * would be found. sampler.draw(out) fills out = {x, y, z, v} (v = ψ at the cell centre).
 */
export function makeSampler(psi, min, max, n = 56, keep = null, cut = 0) {
  const nx = n, ny = n, nz = n;
  const dx = (max[0] - min[0]) / nx, dy = (max[1] - min[1]) / ny, dz = (max[2] - min[2]) / nz;
  const total = nx * ny * nz;
  const cdf = new Float32Array(total), val = new Float32Array(total);
  let acc = 0, i = 0, peak = 0;
  for (let k = 0; k < nz; k++) {
    const z = min[2] + (k + 0.5) * dz;
    for (let j = 0; j < ny; j++) {
      const y = min[1] + (j + 0.5) * dy;
      for (let a = 0; a < nx; a++, i++) {
        const x = min[0] + (a + 0.5) * dx;
        const v = keep && !keep(x, y, z) ? 0 : psi(x, y, z);
        val[i] = v;
        if (v * v > peak) peak = v * v;
      }
    }
  }
  // `cut` > 0 drops the thin outer haze (cells below cut × the peak density), which leaves the
  // crisp lobes of a textbook orbital picture instead of a fog.
  const floor = cut * peak;
  for (i = 0; i < total; i++) { const d = val[i] * val[i]; if (d >= floor) acc += d; cdf[i] = acc; }
  const norm = acc * dx * dy * dz; // ∫|ψ|² over the box (≈ 1 for a normalised orbital)
  return {
    norm,
    draw(out) {
      const u = Math.random() * acc;
      let lo = 0, hi = total - 1;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (cdf[mid] < u) lo = mid + 1; else hi = mid; }
      const a = lo % nx, j = ((lo - a) / nx) % ny, k = (lo - a - j * nx) / (nx * ny);
      out.x = min[0] + (a + Math.random()) * dx;
      out.y = min[1] + (j + Math.random()) * dy;
      out.z = min[2] + (k + Math.random()) * dz;
      out.v = val[lo];
      return out;
    },
  };
}

// ───────── Drawing the cloud ─────────
let dotTex = null;
function softDot() {
  if (dotTex) return dotTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  dotTex = new THREE.CanvasTexture(c);
  return dotTex;
}

/** Physics (z up) → three.js (y up), right-handed. */
export const toScene = (x, y, z, s, out, k = 0) => { out[k] = x * s; out[k + 1] = z * s; out[k + 2] = -y * s; };

/**
 * A cloud of soft dots. Call fill(sampler, scale, colorFn) to draw every dot fresh, or
 * twinkle(count) each frame to move a few dots to new random places.
 */
export class Cloud {
  constructor(max, size = 0.09, opacity = 0.55) {
    this.max = max; this.count = 0; this.cursor = 0;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.val = new Float32Array(max); // ψ at each dot
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setDrawRange(0, 0);
    this.points = new THREE.Points(this.geo, new THREE.PointsMaterial({
      size, map: softDot(), vertexColors: true, transparent: true, opacity, depthWrite: false, sizeAttenuation: true,
    }));
    this.points.frustumCulled = false;
    this._s = { x: 0, y: 0, z: 0, v: 0 };
    this._c = new THREE.Color();
  }
  _put(i) {
    const s = this.sampler.draw(this._s);
    toScene(s.x, s.y, s.z, this.scale, this.pos, i * 3);
    this.val[i] = s.v;
    const c = this.colorFn(s, this._c);
    this.col[i * 3] = c.r; this.col[i * 3 + 1] = c.g; this.col[i * 3 + 2] = c.b;
  }
  fill(sampler, scale, colorFn, count = this.max) {
    this.sampler = sampler; this.scale = scale; this.colorFn = colorFn;
    this.count = Math.min(count, this.max);
    for (let i = 0; i < this.count; i++) this._put(i);
    this.geo.setDrawRange(0, this.count);
    this.commit();
  }
  /** Recolour every dot in place (positions unchanged). fn(x, y, z in scene units, ψ, color) */
  recolor(fn) {
    for (let i = 0; i < this.count; i++) {
      const c = fn(this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2], this.val[i], this._c);
      this.col[i * 3] = c.r; this.col[i * 3 + 1] = c.g; this.col[i * 3 + 2] = c.b;
    }
    this.geo.attributes.color.needsUpdate = true;
  }
  twinkle(n) {
    if (!this.sampler || !this.count) return;
    for (let k = 0; k < n; k++) { this._put(this.cursor); this.cursor = (this.cursor + 1) % this.count; }
    this.commit();
  }
  commit() {
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }
}

export const POS = new THREE.Color(0xffa63d); // ψ > 0
export const NEG = new THREE.Color(0x45b6ff); // ψ < 0
export const signColor = (s, out) => out.copy(s.v >= 0 ? POS : NEG);
