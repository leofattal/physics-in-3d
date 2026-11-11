import * as THREE from 'three';
import { sphere, Curve, textSprite, fmt, clamp } from '../lib/helpers.js';
import {
  hydrogenOrbital, hydrogenExtent, orbitalName, sto1s, sto2p, hybrid, sum, diff, norm3,
  makeSampler, Cloud, signColor, toScene,
} from '../lib/orbitals.js';

const FL = 'https://www.feynmanlectures.caltech.edu/';
const A0 = 0.529177; // Å per Bohr radius
const HARTREE = 27.2114; // eV

const nucleus = (r, color) => sphere(r, color, { emissive: color, emissiveIntensity: 0.35, roughness: 0.3 });
/** Straight line between two physics-space points. */
function stick(a, b, scale, color = 0x90a4ae, opacity = 0.5) {
  const c = new Curve(2, color, opacity), t = [0, 0, 0];
  toScene(a[0], a[1], a[2], scale, t); c.set(0, t[0], t[1], t[2]);
  toScene(b[0], b[1], b[2], scale, t); c.set(1, t[0], t[1], t[2]);
  c.update();
  return c.line;
}
function place(obj, p, scale) { const t = [0, 0, 0]; toScene(p[0], p[1], p[2], scale, t); obj.position.set(t[0], t[1], t[2]); return obj; }
/** One colour per orbital; the small lobe of opposite sign is drawn darker. */
const shaded = (hex) => {
  const pos = new THREE.Color(hex), neg = pos.clone().multiplyScalar(0.4);
  return (s, out) => out.copy(s.v >= 0 ? pos : neg);
};

// ───────────────────────────── 1. Hydrogen orbitals ─────────────────────────────
export const hydrogen = {
  id: 'hydrogen-orbitals',
  unit: 'The Atom',
  title: 'Hydrogen Orbitals: the Electron Cloud',
  feynman: { ref: 'Volume III, Chapter 19 — The Hydrogen Atom and The Periodic Table', url: FL + 'III_19.html' },
  camera: { pos: [5.5, 3.5, 9], target: [0, 0, 0] },
  summary:
    'An electron in an atom has no orbit. It has a wavefunction ψ, and |ψ|² tells you how likely you are to find the electron at each point. Every dot here is one place the electron could turn up, so the dots are dense where it is likely to be. Orange and blue mark where ψ is positive and negative; the empty surfaces between them are nodes, where the electron is never found. Three numbers pick the shape: n sets the size and energy, l the number of angular nodes, and m the orientation.',
  equations: [
    String.raw`\psi_{nlm}(r,\theta,\phi)=R_{nl}(r)\,Y_l^m(\theta,\phi)`,
    String.raw`E_n=-\frac{13.6\ \text{eV}}{n^2}`,
    String.raw`P(\vec r)\,dV=|\psi(\vec r)|^2\,dV`,
  ],
  tryThis: [
    'Step through 1s, 2s, 3s. Turn on the cutaway to see the shells inside. How many spherical nodes does each have? (n − l − 1.)',
    'Set n = 3, l = 2 and step m from −2 to 2: the five d orbitals. Which one looks different from the other four?',
    'Switch to "complex (phase)" with m ≠ 0. The cloud becomes a ring and the colour (the phase of ψ) circulates around z. That circulation is the angular momentum m·ħ.',
  ],
  create(gui) {
    const group = new THREE.Group();
    const p = { n: 2, l: 1, m: 0, mode: 'real (sign)', cutaway: false, dots: 45000, twinkle: true };
    const cloud = new Cloud(90000, 0.085);
    const zAxis = new Curve(2, 0x90a4ae, 0.45);
    zAxis.set(0, 0, -4.2, 0); zAxis.set(1, 0, 4.2, 0); zAxis.update();
    const zl = textSprite('z', { height: 0.3 }); zl.position.set(0.25, 4.2, 0);
    group.add(cloud.points, nucleus(0.06, 0xffffff), zAxis.line, zl);

    let sampler = null, t = 0;
    const col = new THREE.Color();
    const complex = () => p.mode !== 'real (sign)';
    const omega = () => 2.4 / (p.n * p.n); // shown phase speed ∝ |E_n|
    // complex orbital: phase = m·φ − ωt (+π where the real part R·Θ is negative)
    const phaseColor = (x, y, z, v, out) => {
      const phi = Math.atan2(-z, x); // scene → physics azimuth
      const ph = p.m * phi - omega() * t + (v < 0 ? Math.PI : 0);
      return out.setHSL((((ph / (2 * Math.PI)) % 1) + 1) % 1, 0.9, 0.6);
    };
    function rebuild() {
      p.l = clamp(p.l, 0, p.n - 1);
      p.m = clamp(p.m, -p.l, p.l);
      lC.updateDisplay(); mC.updateDisplay();
      const ext = hydrogenExtent(p.n), scale = 3.6 / ext;
      const psi = hydrogenOrbital(p.n, p.l, p.m, { real: !complex() });
      sampler = makeSampler(psi, [-ext, -ext, -ext], [ext, ext, ext], 64, p.cutaway ? (x, y) => y >= 0 : null);
      const tmp = [0, 0, 0];
      cloud.fill(sampler, scale, complex()
        ? (s, out) => { toScene(s.x, s.y, s.z, 1, tmp); return phaseColor(tmp[0], tmp[1], tmp[2], s.v, out); }
        : signColor, p.dots);
    }
    gui.add(p, 'n', 1, 4, 1).name('n (shell)').onChange(rebuild);
    const lC = gui.add(p, 'l', 0, 3, 1).name('l (0=s 1=p 2=d 3=f)').onChange(rebuild);
    const mC = gui.add(p, 'm', -3, 3, 1).name('m (orientation)').onChange(rebuild);
    gui.add(p, 'mode', ['real (sign)', 'complex (phase)']).name('orbital').onChange(rebuild);
    gui.add(p, 'cutaway').name('cutaway (see inside)').onChange(rebuild);
    gui.add(p, 'dots', 10000, 90000, 5000).name('dots').onFinishChange(rebuild);
    gui.add(p, 'twinkle').name('twinkle (re-measure)');
    rebuild();

    return {
      group,
      update(dt) {
        t += dt;
        if (p.twinkle) cloud.twinkle(Math.ceil(cloud.count * 0.012));
        if (complex()) cloud.recolor(phaseColor);
      },
      readout() {
        const { n, l, m } = p;
        return [
          `orbital ${orbitalName(n, l, m, !complex())}`,
          `E = ${(-13.606 / (n * n)).toFixed(2)} eV`,
          `nodes: ${n - l - 1} radial + ${l} angular = ${n - 1}`,
          `mean radius ⟨r⟩ = ${((3 * n * n - l * (l + 1)) / 2).toFixed(1)} a₀  (a₀ = 0.529 Å)`,
          `box holds ${(100 * Math.min(1, sampler.norm * (p.cutaway ? 2 : 1))).toFixed(1)}% of the electron`,
        ].join('\n');
      },
    };
  },
};

// ───────────────────────────── 2. Hybrid orbitals ─────────────────────────────
const ZETA = { H: 1.24, C: 1.625, N: 1.95, O: 2.275 };
const TET = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map(norm3);
const TRI = [0, 120, 240].map((d) => [Math.cos((d * Math.PI) / 180), Math.sin((d * Math.PI) / 180), 0]);
const HYBRIDS = {
  'sp³ (tetrahedral)': { lambda: 3, dirs: TET, left: [] },
  'sp² (trigonal)': { lambda: 2, dirs: TRI, left: [[0, 0, 1]] },
  'sp (linear)': { lambda: 1, dirs: [[1, 0, 0], [-1, 0, 0]], left: [[0, 1, 0], [0, 0, 1]] },
};
const PALETTE = [0xffa63d, 0x45b6ff, 0x5ce1a5, 0xff6b9d];

export const hybrids = {
  id: 'hybrid-orbitals',
  unit: 'Chemical Bonding',
  title: 'Hybrid Orbitals: sp, sp², sp³',
  camera: { pos: [4, 3.2, 6.8], target: [0, 0, 0] },
  summary:
    'Carbon has one 2s and three 2p orbitals in its outer shell. Any mixture of them is also an allowed orbital. Adding s to p reinforces ψ on one side of the nucleus and cancels it on the other, so the mixture is one big lobe that points in a definite direction. That is a good shape for overlapping with a neighbour. Mixing s with one, two or three p orbitals gives two, three or four equal lobes, pointing as far from each other as possible: a line, a triangle, a tetrahedron. These shapes set the angles of molecules.',
  equations: [
    String.raw`h_i=\frac{1}{\sqrt{1+\lambda}}\left(s+\sqrt{\lambda}\;p_{\hat d_i}\right),\quad \lambda=1,2,3`,
    String.raw`\langle h_i|h_j\rangle=0\ \Rightarrow\ \cos\theta_{ij}=-\frac{1}{\lambda}`,
    String.raw`\theta=180^\circ,\ 120^\circ,\ 109.5^\circ`,
  ],
  tryThis: [
    'Show "one hybrid" and compare with "ingredients". Where do s and p have the same sign, and where do they cancel?',
    'In sp³, orbit the view until you look straight down one lobe. The other three make a triangle. What is the angle between any two?',
    'Pick sp² or sp with "leftover p" on. Those unmixed p orbitals stick out sideways; they make the π bonds in the next lessons.',
  ],
  create(gui) {
    const group = new THREE.Group(), content = new THREE.Group();
    group.add(content, nucleus(0.09, 0x90a4ae));
    const p = { type: 'sp³ (tetrahedral)', show: 'all hybrids', leftover: true, haze: false, twinkle: true };
    const EXT = 4.2, SCALE = 3.6 / EXT, C0 = [0, 0, 0], z = ZETA.C;
    let clouds = [];
    function addCloud(psi, colorFn, n = 9000) {
      const c = new Cloud(n, 0.085);
      c.fill(makeSampler(psi, [-EXT, -EXT, -EXT], [EXT, EXT, EXT], 56, null, p.haze ? 0 : 0.1), SCALE, colorFn);
      content.add(c.points); clouds.push(c);
    }
    function rebuild() {
      for (const c of [...content.children]) { content.remove(c); c.geometry?.dispose(); c.material?.dispose(); }
      clouds = [];
      const h = HYBRIDS[p.type];
      if (p.show === 'ingredients (s and p)') {
        addCloud(hybrid(C0, z, [0, 0, 1], 0), shaded(0xe0e6f0), 7000); // λ = 0 → pure 2s
        [[1, 0, 0], [0, 1, 0], [0, 0, 1]].forEach((d, i) => addCloud(sto2p(C0, z, d), shaded(PALETTE[i]), 7000));
      } else {
        const dirs = p.show === 'one hybrid' ? h.dirs.slice(0, 1) : h.dirs;
        dirs.forEach((d, i) => {
          addCloud(hybrid(C0, z, d, h.lambda), shaded(PALETTE[i]));
          content.add(stick(C0, d.map((v) => v * 4.1), SCALE, PALETTE[i], 0.6));
        });
        if (p.leftover) h.left.forEach((d) => addCloud(sto2p(C0, z, d), shaded(0xb388ff), 6000));
      }
    }
    gui.add(p, 'type', Object.keys(HYBRIDS)).name('hybridization').onChange(rebuild);
    gui.add(p, 'show', ['all hybrids', 'one hybrid', 'ingredients (s and p)']).name('show').onChange(rebuild);
    gui.add(p, 'leftover').name('leftover p (violet)').onChange(rebuild);
    gui.add(p, 'haze').name('full cloud (with haze)').onChange(rebuild);
    gui.add(p, 'twinkle').name('twinkle');
    rebuild();
    return {
      group,
      update() { if (p.twinkle) for (const c of clouds) c.twinkle(60); },
      readout() {
        const h = HYBRIDS[p.type];
        return [
          `${h.dirs.length} hybrids, each ${(100 / (1 + h.lambda)).toFixed(0)}% s + ${((100 * h.lambda) / (1 + h.lambda)).toFixed(0)}% p`,
          `angle between lobes = acos(−1/${h.lambda}) = ${((Math.acos(-1 / h.lambda) * 180) / Math.PI).toFixed(1)}°`,
          `unmixed p orbitals left: ${h.left.length}`,
          `bright = ψ > 0, dark = ψ < 0 (small back lobe)`,
        ].join('\n');
      },
    };
  },
};

// ───────────────────────────── 3. The covalent bond: H₂⁺ ─────────────────────────────
// LCAO for one electron shared by two protons, 1s orbitals with exponent 1 (atomic units).
const overlapS = (R) => Math.exp(-R) * (1 + R + (R * R) / 3);
function h2Energy(R, sign) {
  const S = overlapS(R);
  const J = 1 / R - Math.exp(-2 * R) * (1 + 1 / R); // electron on A attracted by proton B
  const K = Math.exp(-R) * (1 + R); // exchange (overlap charge attracted by a proton)
  return -0.5 + 1 / R - (J + sign * K) / (1 + sign * S);
}

export const covalent = {
  id: 'covalent-bond',
  unit: 'Chemical Bonding',
  title: 'The Covalent Bond: Sharing One Electron',
  feynman: { ref: 'Volume III, Chapter 10 — Other Two-State Systems (the hydrogen molecular ion)', url: FL + 'III_10.html' },
  camera: { pos: [0, 1.5, 12.5], target: [0, -1.1, 0] },
  summary:
    'Two protons and one electron make H₂⁺, the simplest molecule. Far apart, the electron sits in a 1s cloud on one proton or the other. Close together, the two clouds overlap and the wavefunctions add. If they add with the same sign, ψ piles up between the protons. The electron there attracts both protons, and the energy drops: a bond. If they add with opposite signs, a node appears between the protons, the electron is pushed outside, and the protons repel. The curve below is the energy against distance. Its lowest point is the bond length.',
  equations: [
    String.raw`\psi_\pm=\frac{\psi_A\pm\psi_B}{\sqrt{2(1\pm S)}},\qquad S=\langle\psi_A|\psi_B\rangle`,
    String.raw`E_\pm(R)=E_{1s}+\frac{1}{R}-\frac{J\pm K}{1\pm S}`,
    String.raw`|\psi_+|^2=\frac{\psi_A^2+\psi_B^2+2\psi_A\psi_B}{2(1+S)}`,
  ],
  tryThis: [
    'Press "bring together" in the bonding state. At what separation is the energy lowest? (This simple model gives 2.5 a₀ = 1.32 Å; the measured bond is 1.06 Å.)',
    'Switch to antibonding at the same R. Where did the electron go, and what happened to the energy?',
    'Push the protons closer than 1 a₀. Why does the energy shoot up even in the bonding state?',
  ],
  create(gui) {
    const group = new THREE.Group();
    const p = { R: 6, state: 'bonding (σ)', twinkle: true, together: () => { anim = true; p.R = 8; } };
    const SCALE = 0.38, RMIN = 0.6, RMAX = 8, PAD = 5.5;
    const cloud = new Cloud(40000, 0.085);
    const pA = nucleus(0.11, 0xff5252), pB = nucleus(0.11, 0xff5252);
    group.add(cloud.points, pA, pB);
    let anim = false;
    const sign = () => (p.state.startsWith('bonding') ? 1 : -1);

    // Energy diagram under the cloud
    const X = (R) => -3.6 + (7.2 * (R - RMIN)) / (RMAX - RMIN);
    const Y = (E) => -4.6 + (clamp(E, -0.6, -0.36) + 0.6) * 7.5;
    const N = 120;
    const mk = (sgn, color) => {
      const c = new Curve(N, color, 0.95);
      for (let i = 0; i < N; i++) { const R = RMIN + ((RMAX - RMIN) * i) / (N - 1); c.set(i, X(R), Y(h2Energy(R, sgn)), 0); }
      c.update(); return c.line;
    };
    const zero = new Curve(2, 0x90a4ae, 0.5);
    zero.set(0, X(RMIN), Y(-0.5), 0); zero.set(1, X(RMAX), Y(-0.5), 0); zero.update();
    const marker = sphere(0.1, 0xffeb3b, { emissive: 0x554400 });
    const lE = textSprite('energy  E(R)', { height: 0.26 }); lE.position.set(-3.1, Y(-0.36) + 0.25, 0);
    const lS = textSprite('separate H + p', { height: 0.22, color: '#90a4ae' }); lS.position.set(2.6, Y(-0.5) + 0.2, 0);
    const lR = textSprite('R →', { height: 0.24, color: '#90a4ae' }); lR.position.set(3.4, -4.85, 0);
    group.add(mk(1, 0x5ce1a5), mk(-1, 0xff6b6b), zero.line, marker, lE, lS, lR);

    function rebuild(fine = true) {
      const a = [-p.R / 2, 0, 0], b = [p.R / 2, 0, 0];
      const A = sto1s(a), B = sto1s(b);
      const hx = p.R / 2 + PAD;
      cloud.fill(makeSampler(sign() > 0 ? sum(A, B) : diff(A, B), [-hx, -PAD, -PAD], [hx, PAD, PAD], fine ? 60 : 40), SCALE, signColor);
      place(pA, a, SCALE); place(pB, b, SCALE);
      marker.position.set(X(p.R), Y(h2Energy(p.R, sign())), 0);
    }
    const rC = gui.add(p, 'R', RMIN, RMAX, 0.05).name('separation R (a₀)').onChange(() => { anim = false; rebuild(); });
    gui.add(p, 'state', ['bonding (σ)', 'antibonding (σ*)']).name('state').onChange(() => rebuild());
    gui.add(p, 'together').name('▶ bring together');
    gui.add(p, 'twinkle').name('twinkle');
    rebuild();

    return {
      group,
      update(dt) {
        if (anim) {
          p.R = Math.max(2.5, p.R - dt * 1.4);
          const done = p.R <= 2.5;
          if (done) anim = false;
          rC.updateDisplay(); rebuild(done);
        } else if (p.twinkle) cloud.twinkle(400);
      },
      readout() {
        const s = sign(), S = overlapS(p.R), E = h2Energy(p.R, s);
        const bind = (E + 0.5) * HARTREE;
        return [
          `R = ${p.R.toFixed(2)} a₀ = ${(p.R * A0).toFixed(2)} Å     overlap S = ${S.toFixed(3)}`,
          `E − E(separate) = ${fmt(bind, 2)} eV  ${bind < 0 ? '(bound)' : '(repelled)'}`,
          `density midway vs. no interference: ×${s > 0 ? (2 / (1 + S)).toFixed(2) : '0 (node)'}`,
          `green = bonding, red = antibonding`,
        ].join('\n');
      },
    };
  },
};

// ───────────────────────────── 4. Building molecules ─────────────────────────────
const ANG = 1 / A0; // Bohr radii per Å
const rad = (d) => (d * Math.PI) / 180;
const add = (a, d, r) => [a[0] + d[0] * r, a[1] + d[1] * r, a[2] + d[2] * r];
const neg = (d) => [-d[0], -d[1], -d[2]];
const EL = { H: [0.1, 0xf5f5f5], C: [0.17, 0x607d8b], N: [0.17, 0x4f7dff], O: [0.17, 0xff5252] };
const KIND = { sigma: 0xffc857, lone: 0xb388ff, pi: 0x5ce1a5 };
/** How far apart the pieces start: bonded distance × (1 + SPREAD·(1 − t)). */
const SPREAD = 1.1;

/** Central atom X with hydrogens along `hd` and lone pairs along `ld`, all sp³-like hybrids. */
function hydride(el, bond, hd, ld, lambda = 3) {
  return (t) => {
    const O = [0, 0, 0], r = bond * ANG * (1 + SPREAD * (1 - t));
    const atoms = [{ el, pos: O }], orbitals = [];
    for (const d of hd) {
      const h = add(O, d, r);
      atoms.push({ el: 'H', pos: h });
      orbitals.push({ kind: 'sigma', fn: sum(hybrid(O, ZETA[el], d, lambda), sto1s(h, ZETA.H)), ends: [O, h] });
    }
    for (const d of ld) orbitals.push({ kind: 'lone', fn: hybrid(O, ZETA[el], d, lambda), ends: [O, O] });
    return { atoms, orbitals };
  };
}
const waterH = [[Math.sin(rad(52.25)), 0, -Math.cos(rad(52.25))], [-Math.sin(rad(52.25)), 0, -Math.cos(rad(52.25))]];
const waterL = [[0, Math.sin(rad(57)), Math.cos(rad(57))], [0, -Math.sin(rad(57)), Math.cos(rad(57))]];
const nh3 = [0, 120, 240].map((d) => [Math.sin(rad(67.9)) * Math.cos(rad(d)), Math.sin(rad(67.9)) * Math.sin(rad(d)), -Math.cos(rad(67.9))]);

const MOLECULES = {
  'H₂  hydrogen': {
    info: 'H–H 0.74 Å · one σ bond from two 1s clouds',
    build: (t) => {
      const r = (0.741 * ANG * (1 + SPREAD * (1 - t))) / 2, a = [-r, 0, 0], b = [r, 0, 0];
      return { atoms: [{ el: 'H', pos: a }, { el: 'H', pos: b }], orbitals: [{ kind: 'sigma', fn: sum(sto1s(a, ZETA.H), sto1s(b, ZETA.H)), ends: [a, b] }] };
    },
  },
  'H₂O  water': { info: 'O–H 0.96 Å · H–O–H 104.5° · 2 bonds + 2 lone pairs', build: hydride('O', 0.958, waterH, waterL) },
  'NH₃  ammonia': { info: 'N–H 1.01 Å · H–N–H 106.7° · 3 bonds + 1 lone pair', build: hydride('N', 1.012, nh3, [[0, 0, 1]]) },
  'CH₄  methane': { info: 'C–H 1.09 Å · H–C–H 109.5° · 4 bonds, no lone pairs', build: hydride('C', 1.087, TET, []) },
  'C₂H₄  ethylene': {
    info: 'C=C 1.34 Å · double bond = 1 σ + 1 π (green, above and below the plane)',
    build: (t) => {
      const k = 1 + SPREAD * (1 - t);
      const cx = (1.339 * ANG * k) / 2, A = [-cx, 0, 0], B = [cx, 0, 0], rh = 1.087 * ANG;
      const c = Math.cos(rad(58.7)), s = Math.sin(rad(58.7));
      const atoms = [{ el: 'C', pos: A }, { el: 'C', pos: B }], orbitals = [];
      for (const [C, sx] of [[A, -1], [B, 1]]) for (const sy of [1, -1]) {
        const d = [sx * c, sy * s, 0], h = add(C, d, rh);
        atoms.push({ el: 'H', pos: h });
        orbitals.push({ kind: 'sigma', fn: sum(hybrid(C, ZETA.C, d, 2), sto1s(h, ZETA.H)), ends: [C, h] });
      }
      orbitals.push({ kind: 'sigma', fn: sum(hybrid(A, ZETA.C, [1, 0, 0], 2), hybrid(B, ZETA.C, [-1, 0, 0], 2)), ends: [A, B] });
      orbitals.push({ kind: 'pi', fn: sum(sto2p(A, ZETA.C, [0, 0, 1]), sto2p(B, ZETA.C, [0, 0, 1])), ends: [A, B] });
      return { atoms, orbitals };
    },
  },
};

export const molecules = {
  id: 'molecules',
  unit: 'Chemical Bonding',
  title: 'Building Molecules from Orbitals',
  camera: { pos: [3.4, 2.6, 6.8], target: [0, 0, 0] },
  summary:
    'A covalent bond forms when a half-filled orbital on one atom overlaps one on its neighbour, and two electrons with opposite spins share the merged cloud. Slide "bond" from 0 to 1 to bring the atoms together and watch each pair of clouds merge into one. Gold clouds are σ bonds, which lie along the line between two nuclei. Violet clouds are lone pairs, which stay on one atom but still take up room and push the bonds closer together. Green is a π bond, made by two p orbitals overlapping side by side. These are sketches built from simple atomic orbitals, so the shapes and angles are right but the sizes are approximate.',
  equations: [
    String.raw`\psi_{\text{bond}}\approx h_A+h_B\quad(\text{two electrons},\ \uparrow\downarrow)`,
    String.raw`\sigma:\ \text{overlap along the bond}`,
    String.raw`\pi:\ \text{overlap beside the bond}`,
    String.raw`\text{CH}_4\ 109.5^\circ\quad \text{NH}_3\ 106.7^\circ\quad \text{H}_2\text{O}\ 104.5^\circ`,
  ],
  tryThis: [
    'Go from CH₄ to NH₃ to H₂O. Each step swaps a bond for a lone pair. What happens to the angle between the remaining bonds, and why?',
    'In ethylene, find the π bond. Why can\'t one CH₂ end twist relative to the other without breaking it?',
    'Set bond = 0 and slowly raise it. At what point do the hydrogen cloud and the hybrid lobe become one cloud?',
  ],
  create(gui) {
    const group = new THREE.Group(), content = new THREE.Group();
    group.add(content);
    const p = { molecule: 'H₂O  water', bond: 1, lonePairs: true, twinkle: true, play: () => { p.bond = 0; anim = true; } };
    let clouds = [], anim = false, scale = 1;
    function clear() {
      for (const c of [...content.children]) {
        content.remove(c);
        c.traverse((o) => { o.geometry?.dispose(); o.material?.map?.dispose(); o.material?.dispose(); });
      }
      clouds = [];
    }
    function rebuild(fine = true) {
      clear();
      const mol = MOLECULES[p.molecule];
      const far = mol.build(0), now = mol.build(p.bond);
      // one scale per molecule, set by its fully separated size, so the approach is visible
      const ext = Math.max(...far.atoms.map((a) => Math.hypot(...a.pos))) + 1.6;
      scale = 4 / ext;
      for (const a of now.atoms) {
        const [r, color] = EL[a.el];
        content.add(place(nucleus(r, color), a.pos, scale));
        if (a.el !== 'H') { const l = textSprite(a.el, { height: 0.3 }); place(l, a.pos, scale); l.position.y += 0.38; content.add(l); }
      }
      for (const o of now.orbitals) {
        if (o.kind === 'lone' && !p.lonePairs) continue;
        const [a, b] = o.ends, pad = 3.2;
        const min = [0, 1, 2].map((i) => Math.min(a[i], b[i]) - pad), max = [0, 1, 2].map((i) => Math.max(a[i], b[i]) + pad);
        const c = new Cloud(o.kind === 'lone' ? 5000 : 7000, 0.08);
        c.fill(makeSampler(o.fn, min, max, fine ? 44 : 28, null, 0.12), scale, shaded(KIND[o.kind]));
        content.add(c.points); clouds.push(c);
        if (o.kind === 'sigma' && p.bond > 0.97) content.add(stick(a, b, scale, 0xffffff, 0.35));
      }
    }
    gui.add(p, 'molecule', Object.keys(MOLECULES)).name('molecule').onChange(() => rebuild());
    const bC = gui.add(p, 'bond', 0, 1, 0.01).name('bond (0 = apart)').onChange(() => { anim = false; rebuild(); });
    gui.add(p, 'play').name('▶ form the bonds');
    gui.add(p, 'lonePairs').name('lone pairs (violet)').onChange(() => rebuild());
    gui.add(p, 'twinkle').name('twinkle');
    rebuild();

    return {
      group,
      update(dt) {
        if (anim) {
          p.bond = Math.min(1, p.bond + dt * 0.3);
          if (p.bond >= 1) anim = false;
          bC.updateDisplay(); rebuild(!anim);
        } else if (p.twinkle) for (const c of clouds) c.twinkle(40);
      },
      readout() {
        const mol = MOLECULES[p.molecule], o = mol.build(1).orbitals;
        const n = (k) => o.filter((x) => x.kind === k).length;
        return [
          mol.info,
          `σ bonds ${n('sigma')} (gold)   π bonds ${n('pi')} (green)   lone pairs ${n('lone')} (violet)`,
          `valence electrons shown: ${2 * o.length}   (2 per cloud)`,
          p.bond < 0.97 ? `atoms at ${(1 + SPREAD * (1 - p.bond)).toFixed(2)} × bond length` : 'bonded',
        ].join('\n');
      },
    };
  },
};
