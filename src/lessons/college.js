import * as THREE from 'three';
import { V, mat, sphere, box, makeArrow, setArrow, Trail, Curve, ArrowField, textSprite, heat, floorGrid, fibonacciSphere, disposeObject, fmt, clamp } from '../lib/helpers.js';

// ───────────────────────────── 1. Kepler orbits ─────────────────────────────
export const orbits = {
  id: 'orbits',
  unit: 'Gravitation',
  title: "Orbits & Kepler's Laws",
  camera: { pos: [0, 9, 9], target: [-1, 0, 0] },
  summary:
    'A planet moves under an inverse-square pull, computed step by step. Change its launch speed to get circles, ellipses, or escape. The colored wedges each cover the same amount of time, and they all have the same area. That is Kepler\'s second law, and it follows from conservation of angular momentum.',
  equations: [
    String.raw`\vec F = -\frac{GMm}{r^2}\,\hat r`,
    String.raw`\frac{dA}{dt} = \frac{L}{2m} = \text{const}`,
    String.raw`E = \tfrac12 v^2 - \frac{GM}{r}\ \ (<0\Rightarrow\text{bound})`,
  ],
  tryThis: [
    'Find the speed where the orbit becomes a perfect circle (speed = 1.00 × v_circ).',
    'Find the escape speed. Theory says √2 ≈ 1.414 × v_circ. What sign does the energy E have there?',
    'Look at the wedges near the Sun and far from it. Their shapes differ, but compare their areas in the readout.',
  ],
  create(gui) {
    const group = new THREE.Group();
    const GM = 4, R0 = 4;
    const p = { speed: 0.75, wedgeTime: 1.0, showWedges: true, showVectors: true, restart: () => reset() };

    const sun = sphere(0.45, 0xffcc33, { emissive: 0xffaa00, emissiveIntensity: 1.2 });
    const light = new THREE.PointLight(0xffeecc, 30, 0, 1.5);
    const planet = sphere(0.15, 0x4fc3f7);
    const trail = new Trail(5000, 0x90caf9, 0.6);
    const vA = makeArrow(0x66bb6a), aA = makeArrow(0xef5350);
    group.add(sun, light, planet, trail.line, vA, aA, floorGrid(24, 24, -0.6));

    const pos = V(), vel = V(), acc = V();
    let wedges = [], wedgePts = [], wt = 0, areas = [], wedgeCount = 0;
    const accel = (r, out) => { const d = r.length(); return out.copy(r).multiplyScalar(-GM / (d * d * d)); };

    function clearWedges() { wedges.forEach((w) => { group.remove(w); disposeObject(w); }); wedges = []; areas = []; }
    function reset() {
      pos.set(R0, 0, 0);
      vel.set(0, 0, -p.speed * Math.sqrt(GM / R0));
      trail.clear(); clearWedges();
      wedgePts = [pos.clone()]; wt = 0;
    }
    function makeWedge() {
      const arr = [];
      let area = 0;
      for (let i = 0; i < wedgePts.length - 1; i++) {
        const a = wedgePts[i], b = wedgePts[i + 1];
        arr.push(0, 0, 0, a.x, a.y, a.z, b.x, b.y, b.z);
        area += 0.5 * Math.abs(a.x * b.z - a.z * b.x);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
        color: wedgeCount++ % 2 ? 0x4fc3f7 : 0xffb74d, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false,
      }));
      m.visible = p.showWedges;
      group.add(m); wedges.push(m); areas.push(area);
      if (wedges.length > 10) { const w = wedges.shift(); group.remove(w); disposeObject(w); }
      if (areas.length > 5) areas.shift();
    }

    gui.add(p, 'speed', 0.3, 1.6, 0.01).name('launch speed × v_circ').onChange(reset);
    gui.add(p, 'wedgeTime', 0.4, 3, 0.1).name('wedge Δt (s)').onChange(reset);
    gui.add(p, 'showWedges').name('equal-area wedges').onChange((v) => wedges.forEach((w) => (w.visible = v)));
    gui.add(p, 'showVectors').name('v (green), a (red)');
    gui.add(p, 'restart').name('↺ Restart');
    reset();

    return {
      group,
      update(dt) {
        const n = 20, h = dt / n;
        for (let i = 0; i < n; i++) {
          accel(pos, acc); vel.addScaledVector(acc, h / 2);
          pos.addScaledVector(vel, h);
          accel(pos, acc); vel.addScaledVector(acc, h / 2);
        }
        if (pos.length() < 0.5 || pos.length() > 35) return reset();
        planet.position.copy(pos);
        trail.push(pos);
        wedgePts.push(pos.clone());
        wt += dt;
        if (wt >= p.wedgeTime) { makeWedge(); wedgePts = [pos.clone()]; wt = 0; }
        setArrow(vA, pos, vel, 1); setArrow(aA, pos, acc, 3);
        vA.visible &&= p.showVectors; aA.visible &&= p.showVectors;
      },
      readout() {
        const r = pos.length(), v = vel.length();
        const E = 0.5 * v * v - GM / r, L = Math.abs(pos.x * vel.z - pos.z * vel.x);
        return [
          `r = ${r.toFixed(2)}   |v| = ${v.toFixed(3)}`,
          `E = ${fmt(E, 3)}  ${E < 0 ? '(bound orbit)' : '(escapes!)'}`,
          `L = |r × v| = ${L.toFixed(3)}  (constant)`,
          `wedge areas: ${areas.map((a) => a.toFixed(2)).join('  ') || '…'}`,
          `L·Δt/2 = ${((L * p.wedgeTime) / 2).toFixed(2)}  ← Kepler II`,
        ].join('\n');
      },
    };
  },
};

// ───────────────────────────── 2. Electric fields in 3D ─────────────────────────────
const PRESETS = {
  dipole: [[1, -1.5, 0, 0], [-1, 1.5, 0, 0]],
  'like charges': [[1, -1.5, 0, 0], [1, 1.5, 0, 0]],
  'single charge': [[1, 0, 0, 0]],
  'unequal (+2, −1)': [[2, -1.5, 0, 0], [-1, 1.5, 0, 0]],
  quadrupole: [[1, -1.5, 0, -1.5], [-1, 1.5, 0, -1.5], [-1, -1.5, 0, 1.5], [1, 1.5, 0, 1.5]],
  'tetrahedron (3D)': [[1, 1.5, 1.5, 1.5], [1, -1.5, -1.5, 1.5], [-1, -1.5, 1.5, -1.5], [-1, 1.5, -1.5, -1.5]],
};

export const efield = {
  id: 'efield',
  unit: 'Electromagnetism',
  title: 'Electric Fields in 3D',
  camera: { pos: [6, 5, 8], target: [0, 0, 0] },
  summary:
    'The arrows show the electric field on a 3D grid, colored from weak (blue) to strong (red). The yellow field lines start on positive charges and end on negative ones. Release a positive test charge to see it pushed along the field. It has inertia, so it does not follow a line exactly.',
  equations: [
    String.raw`\vec E(\vec r) = \sum_i \frac{k q_i\,(\vec r-\vec r_i)}{|\vec r-\vec r_i|^3}`,
    String.raw`\vec F = q\vec E`,
    String.raw`\nabla\cdot\vec E = \rho/\varepsilon_0`,
  ],
  tryThis: [
    'Pick "like charges" and find the point where the field is exactly zero.',
    'Compare how many lines leave +2 and how many arrive at −1 in "unequal". Where do the rest go?',
    'Orbit the camera around the "tetrahedron" preset. A 2D textbook figure can\'t show this.',
  ],
  create(gui) {
    const group = new THREE.Group();
    const p = { preset: 'dipole', separation: 3, showVectors: true, showLines: true, lines: 14, release: () => releaseTest() };
    const chargeGroup = new THREE.Group(), lineGroup = new THREE.Group();
    const af = new ArrowField(800);
    group.add(chargeGroup, lineGroup, af.mesh);

    let charges = [];
    const _d = V(), e = V(), e2 = V(), tmp = V(), col = new THREE.Color();
    function E(r, out) {
      out.set(0, 0, 0);
      for (const c of charges) {
        _d.subVectors(r, c.pos);
        const r2 = _d.lengthSq() + 0.02;
        out.addScaledVector(_d, c.q / (r2 * Math.sqrt(r2)));
      }
      return out;
    }
    function trace(start, sign) {
      const pts = [], r = start.clone(), mid = V();
      for (let k = 0; k < 700; k++) {
        pts.push(r.clone());
        E(r, e);
        if (e.lengthSq() < 1e-10) break;
        e.normalize().multiplyScalar(0.03 * sign);
        mid.copy(r).add(e);
        E(mid, e2).normalize().multiplyScalar(0.06 * sign);
        r.add(e2);
        if (r.length() > 10) break;
        if (charges.some((c) => c.q * sign < 0 && r.distanceTo(c.pos) < 0.15)) { pts.push(r.clone()); break; }
      }
      return pts;
    }
    function build() {
      [chargeGroup, lineGroup].forEach((g) => { disposeObject(g); g.clear(); });
      charges = PRESETS[p.preset].map(([q, x, y, z]) => ({ q, pos: V(x, y, z).multiplyScalar(p.separation / 3) }));
      for (const c of charges) {
        const m = sphere(0.16 + 0.06 * Math.abs(c.q), c.q > 0 ? 0xef5350 : 0x42a5f5, { emissive: c.q > 0 ? 0x551111 : 0x112255 });
        m.position.copy(c.pos);
        const l = textSprite(c.q > 0 ? `+${c.q}` : `−${-c.q}`, { height: 0.3 });
        l.position.copy(c.pos).add(V(0, 0.5, 0));
        chargeGroup.add(m, l);
      }
      let i = 0;
      for (let x = -4; x <= 4; x++) for (let y = -2; y <= 2; y++) for (let z = -4; z <= 4; z++) {
        const r = V(x, y, z);
        if (charges.some((c) => c.pos.distanceTo(r) < 0.6)) continue;
        E(r, e);
        const mag = e.length();
        af.set(i++, tmp.copy(r).addScaledVector(e, -0.25 / mag), e, 0.5, heat((Math.log10(mag) + 2) / 2.3, col));
      }
      af.commit(i);
      af.mesh.visible = p.showVectors;
      let src = charges.filter((c) => c.q > 0), sign = 1;
      if (!src.length) { src = charges; sign = -1; }
      for (const c of src) {
        for (const d of fibonacciSphere(Math.round(p.lines * Math.abs(c.q)))) {
          const pts = trace(c.pos.clone().addScaledVector(d, 0.22), sign);
          lineGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
            new THREE.LineBasicMaterial({ color: 0xffe082, transparent: true, opacity: 0.75 })));
        }
      }
      lineGroup.visible = p.showLines;
      tests.forEach(killTest); tests = [];
    }

    let tests = [];
    function killTest(tc) { group.remove(tc.mesh, tc.trail.line); disposeObject(tc.mesh); disposeObject(tc.trail.line); }
    function releaseTest() {
      if (tests.length >= 8) killTest(tests.shift());
      const mesh = sphere(0.09, 0xfff176, { emissive: 0x887700 });
      const trail = new Trail(1500, 0xfff176, 0.8);
      const pos = V((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 8);
      group.add(mesh, trail.line);
      tests.push({ mesh, trail, pos, vel: V(), age: 0 });
    }

    gui.add(p, 'preset', Object.keys(PRESETS)).onChange(build);
    gui.add(p, 'separation', 1, 6, 0.1).onChange(build);
    gui.add(p, 'lines', 4, 30, 1).name('lines per charge').onChange(build);
    gui.add(p, 'showVectors').name('field arrows').onChange((v) => (af.mesh.visible = v));
    gui.add(p, 'showLines').name('field lines').onChange((v) => (lineGroup.visible = v));
    gui.add(p, 'release').name('⚡ Release test charge');
    build();

    return {
      group,
      update(dt) {
        const n = 10, h = dt / n;
        tests = tests.filter((tc) => {
          for (let i = 0; i < n; i++) {
            E(tc.pos, e);
            tc.vel.addScaledVector(e, 2 * h);
            tc.pos.addScaledVector(tc.vel, h);
          }
          tc.age += dt;
          tc.mesh.position.copy(tc.pos);
          tc.trail.push(tc.pos);
          const dead = tc.age > 25 || tc.pos.length() > 14 || charges.some((c) => c.q < 0 && c.pos.distanceTo(tc.pos) < 0.25);
          if (dead) killTest(tc);
          return !dead;
        });
      },
      readout() {
        const Q = charges.reduce((s, c) => s + c.q, 0);
        return [`charges   ${charges.length}   net Q = ${Q > 0 ? '+' : ''}${Q}`, `test charges in flight: ${tests.length}`, 'k = 1 units'].join('\n');
      },
    };
  },
};

// ───────────────────────────── 3. Lorentz force ─────────────────────────────
export const magnetic = {
  id: 'magnetic',
  unit: 'Electromagnetism',
  title: 'Charged Particles in Magnetic Fields',
  camera: { pos: [7, 3, 8], target: [0, 0, 0] },
  summary:
    'A magnetic field (purple, pointing up) pushes a moving charge sideways, always perpendicular to its velocity. It changes the direction of motion but not the speed. The result is circles, or helices when the particle also moves along B. Add an electric field and the circles drift sideways: the E×B drift that confines plasma in fusion reactors and traps particles in Earth\'s radiation belts.',
  equations: [
    String.raw`\vec F = q(\vec E + \vec v\times\vec B)`,
    String.raw`r_c = \frac{m v_\perp}{|q|B},\qquad \omega_c = \frac{|q|B}{m}`,
    String.raw`\vec v_d = \frac{\vec E\times\vec B}{B^2}`,
  ],
  tryThis: [
    'Double B. Does the radius halve? Does the period change?',
    'Flip the sign of the charge. Which way does it spiral now?',
    'Add E = 0.5. Which way does it drift? Predict it with the right-hand rule for E×B first.',
  ],
  create(gui) {
    const group = new THREE.Group();
    const p = { B: 1, E: 0, charge: 1, mass: 1, vPerp: 2, vPar: 0.3, restart: () => reset() };
    for (let x = -4; x <= 4; x += 2) for (let z = -4; z <= 4; z += 2) {
      const a = new THREE.ArrowHelper(V(0, 1, 0), V(x, -3.5, z), 7, 0x7e57c2, 0.4, 0.2);
      a.line.material.transparent = true; a.line.material.opacity = 0.35;
      group.add(a);
    }
    const eArrows = [-2, 0, 2].map((y) => {
      const a = new THREE.ArrowHelper(V(1, 0, 0), V(-5, y, -5), 10, 0xffa726, 0.4, 0.2);
      group.add(a); return a;
    });
    const particle = sphere(0.14, 0xffee58, { emissive: 0x887700 });
    const trail = new Trail(4000, 0xfff59d, 0.85);
    const vA = makeArrow(0x66bb6a), fA = makeArrow(0xef5350);
    group.add(particle, trail.line, vA, fA);

    const pos = V(), vel = V(), Bv = V(), Ev = V(), tv = V(), sv = V(), vm = V(), vp = V(), F = V(), tmp = V();
    function reset() { pos.set(0, -3, 0); vel.set(p.vPerp, p.vPar, 0); trail.clear(); }
    gui.add(p, 'B', 0.2, 3, 0.05).name('B (up)');
    gui.add(p, 'E', -1, 1, 0.05).name('E (along x)');
    gui.add(p, 'charge', [-1, 1]).onChange(reset);
    gui.add(p, 'mass', 0.2, 4, 0.1);
    gui.add(p, 'vPerp', 0.2, 4, 0.1).name('v⊥').onChange(reset);
    gui.add(p, 'vPar', -1, 1.5, 0.05).name('v∥ (along B)').onChange(reset);
    gui.add(p, 'restart').name('↺ Restart');
    reset();

    return {
      group,
      update(dt) {
        const qm = p.charge / p.mass, n = 20, h = dt / n;
        Bv.set(0, p.B, 0); Ev.set(p.E, 0, 0);
        for (let i = 0; i < n; i++) { // Boris pusher: exactly preserves |v| when E = 0
          vm.copy(vel).addScaledVector(Ev, (qm * h) / 2);
          tv.copy(Bv).multiplyScalar((qm * h) / 2);
          sv.copy(tv).multiplyScalar(2 / (1 + tv.lengthSq()));
          vp.copy(vm).add(tmp.crossVectors(vm, tv));
          vm.add(tmp.crossVectors(vp, sv));
          vel.copy(vm).addScaledVector(Ev, (qm * h) / 2);
          pos.addScaledVector(vel, h);
        }
        if (Math.abs(pos.y) > 4.5 || Math.abs(pos.x) > 9 || Math.abs(pos.z) > 9) reset();
        particle.position.copy(pos);
        trail.push(pos);
        F.crossVectors(vel, Bv).add(Ev).multiplyScalar(p.charge);
        setArrow(vA, pos, vel, 0.5); setArrow(fA, pos, F, 0.5);
        eArrows.forEach((a) => { a.visible = Math.abs(p.E) > 0.01; a.setDirection(V(Math.sign(p.E) || 1, 0, 0)); a.position.x = p.E >= 0 ? -5 : 5; });
      },
      readout() {
        const w = (Math.abs(p.charge) * p.B) / p.mass;
        return [
          `|v|      ${vel.length().toFixed(3)}  ${p.E === 0 ? '(constant: B does no work)' : ''}`,
          `r_c      ${(p.vPerp / w).toFixed(3)}`,
          `T = 2π/ω ${((2 * Math.PI) / w).toFixed(3)} s`,
          `drift    E/B = ${(Math.abs(p.E) / p.B).toFixed(3)} ${p.E ? (p.E > 0 ? '→ +z (E×B)' : '→ −z') : ''}`,
        ].join('\n');
      },
    };
  },
};

// ───────────────────────────── 4. Quantum particle in a box ─────────────────────────────
export const quantumBox = {
  id: 'quantum-box',
  unit: 'Quantum Mechanics',
  title: 'Quantum Particle in a Box',
  camera: { pos: [3.5, 3, 12.5], target: [0, -0.4, 0] },
  summary:
    'The wavefunction ψ is a complex number at each point. Here it is drawn in true 3D: x runs along the box, and the real and imaginary parts are the two other axes. The color shows the phase. A single energy level just spins in place and its probability (purple, below) never changes. Mix two levels and they beat against each other, making the probability slosh back and forth.',
  equations: [
    String.raw`\psi_n(x)=\sqrt{\tfrac{2}{L}}\sin\frac{n\pi x}{L},\quad E_n=\frac{n^2\pi^2\hbar^2}{2mL^2}`,
    String.raw`\Psi(x,t)=c_1\psi_{n_1}e^{-iE_{n_1}t/\hbar}+c_2\psi_{n_2}e^{-iE_{n_2}t/\hbar}`,
    String.raw`T_{\rm slosh} = \frac{2\pi\hbar}{E_{n_2}-E_{n_1}}`,
  ],
  tryThis: [
    'Set mix = 0 (a pure state). The ψ curve rotates, but does the purple probability move at all?',
    'Mix n=1 and n=2 equally and watch ⟨x⟩ slosh. Then try n=1 with n=3. Why does ⟨x⟩ stop moving?',
    'Why must ψ be zero at the walls? Count the nodes of ψ_n.',
  ],
  create(gui) {
    const group = new THREE.Group();
    const N = 240, HALF = 4, BASE = -2.4, AXIS = 1.0;
    const p = { n1: 1, n2: 2, mix: 0.5, timeScale: 0.15, amplitude: 1.1 };

    for (const x of [-HALF - 0.1, HALF + 0.1]) {
      const w = box(0.2, 6, 3, 0x546e7a, { transparent: true, opacity: 0.35 });
      w.position.set(x, -0.3, 0);
      group.add(w);
    }
    const axis = new Curve(2, 0x90a4ae, 0.6);
    axis.set(0, -HALF, AXIS, 0); axis.set(1, HALF, AXIS, 0); axis.update();
    const baseLine = new Curve(2, 0x90a4ae, 0.6);
    baseLine.set(0, -HALF, BASE, 0); baseLine.set(1, HALF, BASE, 0); baseLine.update();

    const psiPos = new Float32Array(N * 3), psiCol = new Float32Array(N * 3);
    const psiGeo = new THREE.BufferGeometry();
    psiGeo.setAttribute('position', new THREE.BufferAttribute(psiPos, 3));
    psiGeo.setAttribute('color', new THREE.BufferAttribute(psiCol, 3));
    const psi = new THREE.Line(psiGeo, new THREE.LineBasicMaterial({ vertexColors: true }));
    psi.frustumCulled = false;
    const re = new Curve(N, 0xef5350, 0.35); // shadow of Re ψ on the back wall
    const rib = new THREE.BufferGeometry(), rp = new Float32Array(N * 6), idx = [];
    for (let i = 0; i < N - 1; i++) { const a = 2 * i; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    rib.setIndex(idx);
    rib.setAttribute('position', new THREE.BufferAttribute(rp, 3));
    const ribbon = new THREE.Mesh(rib, new THREE.MeshBasicMaterial({ color: 0xb388ff, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
    ribbon.frustumCulled = false;
    const xMark = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 16), mat(0xffeb3b, { emissive: 0x554400 }));
    const l1 = textSprite('Ψ (Re, Im)', { height: 0.3 }); l1.position.set(-HALF - 1, AXIS + 0.6, 0);
    const l2 = textSprite('|Ψ|²', { height: 0.3 }); l2.position.set(-HALF - 0.8, BASE + 0.4, 0);
    group.add(axis.line, baseLine.line, psi, re.line, ribbon, xMark, l1, l2);

    gui.add(p, 'n1', 1, 6, 1).name('level n₁');
    gui.add(p, 'n2', 1, 6, 1).name('level n₂');
    gui.add(p, 'mix', 0, 1, 0.01).name('mix (0=n₁, 1=n₂)');
    gui.add(p, 'timeScale', 0.02, 0.5, 0.01).name('time scale');
    gui.add(p, 'amplitude', 0.5, 2, 0.05).name('display scale');

    let t = 0, xAvg = 0;
    const col = new THREE.Color();
    return {
      group,
      update(dt) {
        t += dt * p.timeScale;
        const c1 = Math.cos((p.mix * Math.PI) / 2), c2 = Math.sin((p.mix * Math.PI) / 2);
        const E1 = (p.n1 ** 2 * Math.PI ** 2) / 2, E2 = (p.n2 ** 2 * Math.PI ** 2) / 2;
        const A = p.amplitude, s2 = Math.SQRT2;
        let sum = 0, sumx = 0;
        for (let i = 0; i < N; i++) {
          const xi = i / (N - 1), x = (xi - 0.5) * 2 * HALF;
          const f1 = s2 * Math.sin(p.n1 * Math.PI * xi), f2 = s2 * Math.sin(p.n2 * Math.PI * xi);
          const R = c1 * f1 * Math.cos(E1 * t) + c2 * f2 * Math.cos(E2 * t);
          const I = -c1 * f1 * Math.sin(E1 * t) - c2 * f2 * Math.sin(E2 * t);
          const d = R * R + I * I;
          sum += d; sumx += d * x;
          psiPos.set([x, AXIS + A * R, A * I], i * 3);
          col.setHSL((Math.atan2(I, R) / (2 * Math.PI) + 1) % 1, 0.9, 0.6);
          psiCol.set([col.r, col.g, col.b], i * 3);
          re.set(i, x, AXIS + A * R, -1.6);
          rp.set([x, BASE, 0, x, BASE + 0.55 * d, 0], i * 6);
        }
        xAvg = sumx / sum;
        psiGeo.attributes.position.needsUpdate = true;
        psiGeo.attributes.color.needsUpdate = true;
        rib.attributes.position.needsUpdate = true;
        re.update();
        xMark.position.set(xAvg, BASE - 0.25, 0);
      },
      readout() {
        const E = (n) => (n * n * Math.PI ** 2) / 2;
        const dE = Math.abs(E(p.n2) - E(p.n1));
        return [
          `E_n1 = ${E(p.n1).toFixed(2)}   E_n2 = ${E(p.n2).toFixed(2)}   (ħ=m=L=1)`,
          `⟨x⟩  = ${fmt(xAvg / (2 * HALF), 3)} L   (yellow cone)`,
          `slosh period 2π/ΔE = ${dE > 0 && p.mix > 0 && p.mix < 1 ? ((2 * Math.PI) / dE).toFixed(3) : '∞ (stationary)'}`,
        ].join('\n');
      },
    };
  },
};
