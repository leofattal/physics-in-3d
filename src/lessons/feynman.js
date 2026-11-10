import * as THREE from 'three';
import { V, mat, sphere, box, makeArrow, setArrow, Trail, Curve, ArrowField, textSprite, heat, floorGrid, fibonacciSphere, disposeObject, fmt, clamp } from '../lib/helpers.js';

const FL = 'https://www.feynmanlectures.caltech.edu/';

// ───────────────────────────── Vol I, Ch 1: Atoms in Motion ─────────────────────────────
export const atoms = {
  id: 'feynman-atoms',
  unit: 'Vol. I · Ch. 1',
  title: 'Atoms in Motion',
  feynman: { ref: 'Volume I, Chapter 1 — Atoms in Motion', url: FL + 'I_01.html' },
  camera: { pos: [7, 5, 10], target: [0, -0.5, 0] },
  summary:
    'Feynman starts the whole course with one idea: everything is made of atoms that attract each other at a distance and repel when squeezed together. Here 125 atoms interact through that one rule, the Lennard-Jones force. Turn the temperature up and down to see a crystal, a liquid, and a gas form from the same rule. Heat is just this jiggling.',
  equations: [
    String.raw`U(r) = 4\varepsilon\left[\left(\tfrac{\sigma}{r}\right)^{12}-\left(\tfrac{\sigma}{r}\right)^{6}\right]`,
    String.raw`\tfrac32 k_BT = \langle \tfrac12 m v^2\rangle`,
  ],
  tryThis: [
    'Cool to 0.05. The atoms settle into a regular, packed crystal.',
    'Heat slowly to 0.7 and then 2.0. When does the cluster melt, and when does it evaporate?',
    'Turn on gravity at a medium temperature. You get a "liquid" puddle with "vapor" above it.',
  ],
  create(gui) {
    const group = new THREE.Group();
    const N = 125, H = 4.5;
    const p = { temperature: 0.3, gravity: 0, thermostat: true, colorBySpeed: true, reset: () => init() };
    const x = new Float32Array(N * 3), v = new Float32Array(N * 3), f = new Float32Array(N * 3);
    const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.42, 16, 12), mat(0xffffff, { roughness: 0.3 }), N);
    mesh.frustumCulled = false;
    const frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(2 * H, 2 * H, 2 * H)),
      new THREE.LineBasicMaterial({ color: 0x4f6d8f }));
    group.add(mesh, frame);

    function init() {
      let k = 0;
      for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) for (let l = 0; l < 5; l++) {
        x[k] = (i - 2) * 1.12; x[k + 1] = (j - 2) * 1.12; x[k + 2] = (l - 2) * 1.12;
        for (let d = 0; d < 3; d++) v[k + d] = (Math.random() - 0.5) * 2 * Math.sqrt(3 * p.temperature);
        k += 3;
      }
      forces();
    }
    function forces() {
      f.fill(0);
      for (let i = 0; i < N; i++) {
        const a = 3 * i;
        for (let j = i + 1; j < N; j++) {
          const b = 3 * j;
          const dx = x[a] - x[b], dy = x[a + 1] - x[b + 1], dz = x[a + 2] - x[b + 2];
          let r2 = dx * dx + dy * dy + dz * dz;
          if (r2 > 6.25) continue;
          r2 = Math.max(r2, 0.7);
          const ir2 = 1 / r2, ir6 = ir2 * ir2 * ir2, fm = 24 * ir2 * ir6 * (2 * ir6 - 1);
          f[a] += fm * dx; f[a + 1] += fm * dy; f[a + 2] += fm * dz;
          f[b] -= fm * dx; f[b + 1] -= fm * dy; f[b + 2] -= fm * dz;
        }
        f[a + 1] -= p.gravity;
      }
    }
    let Tcur = 0;
    function step(h) {
      for (let i = 0; i < 3 * N; i++) { v[i] += 0.5 * h * f[i]; x[i] += h * v[i]; }
      for (let i = 0; i < 3 * N; i++) {
        const lim = H - 0.42;
        if (x[i] < -lim) { x[i] = -lim; v[i] = Math.abs(v[i]); }
        else if (x[i] > lim) { x[i] = lim; v[i] = -Math.abs(v[i]); }
      }
      forces();
      for (let i = 0; i < 3 * N; i++) v[i] += 0.5 * h * f[i];
    }

    gui.add(p, 'temperature', 0.02, 3, 0.01).name('temperature 🔥');
    gui.add(p, 'gravity', 0, 0.5, 0.01);
    gui.add(p, 'thermostat').name('heat bath on');
    gui.add(p, 'reset').name('↺ Reset crystal');
    init();

    const m = new THREE.Matrix4(), col = new THREE.Color();
    return {
      group,
      update(dt) {
        const steps = Math.max(1, Math.round(dt / 0.004));
        for (let s = 0; s < Math.min(steps, 12); s++) step(0.004);
        let ke = 0;
        for (let i = 0; i < 3 * N; i++) ke += 0.5 * v[i] * v[i];
        Tcur = (2 * ke) / (3 * N);
        if (p.thermostat && Tcur > 0) {
          const lam = Math.sqrt(1 + 0.05 * (p.temperature / Tcur - 1));
          for (let i = 0; i < 3 * N; i++) v[i] *= clamp(lam, 0.9, 1.1);
        }
        for (let i = 0; i < N; i++) {
          const a = 3 * i;
          m.makeTranslation(x[a], x[a + 1], x[a + 2]);
          mesh.setMatrixAt(i, m);
          const sp2 = v[a] ** 2 + v[a + 1] ** 2 + v[a + 2] ** 2;
          mesh.setColorAt(i, heat(sp2 / (6 * Math.max(Tcur, 0.05)), col));
        }
        mesh.instanceMatrix.needsUpdate = true;
        mesh.instanceColor.needsUpdate = true;
      },
      readout() {
        const phase = Tcur < 0.45 ? 'solid-like (vibrating in place)' : Tcur < 1.1 ? 'liquid-like (sliding past)' : 'gas-like (flying free)';
        return [`T (measured)  ${Tcur.toFixed(3)} ε/k_B`, `T (target)    ${p.temperature.toFixed(2)}`, `looks         ${phase}`, `color = speed (blue slow → red fast)`].join('\n');
      },
    };
  },
};

// ───────────────────────────── Vol I, Ch 9: Newton's laws — the numerical orbit ─────────────────────────────
export const numericalOrbit = {
  id: 'feynman-orbit',
  unit: 'Vol. I · Ch. 9',
  title: "Newton's Laws: Computing an Orbit by Hand",
  feynman: { ref: "Volume I, Chapter 9 — Newton's Laws of Dynamics (planetary motion, numerical solution)", url: FL + 'I_09.html' },
  camera: { pos: [0, 7, 4.5], target: [-0.6, 0, 0] },
  summary:
    'Feynman shows you can predict a planet\'s motion without calculus tricks. Start from F = ma and step forward in small time intervals ε, updating position, then acceleration, then velocity. He uses GM = 1 and starts at x = 0.5, y = 0, v_y = 1.63, with ε = 0.1. This scene runs that exact recipe one step at a time and prints the table he builds by hand. The faint ring is the exact orbit. Try a coarser ε to see how the hand calculation drifts.',
  equations: [
    String.raw`a_x = -\frac{x}{r^3},\quad a_y = -\frac{y}{r^3}\quad(GM=1)`,
    String.raw`v(t+\tfrac{\varepsilon}{2}) = v(t-\tfrac{\varepsilon}{2}) + \varepsilon\,a(t)`,
    String.raw`x(t+\varepsilon) = x(t) + \varepsilon\,v(t+\tfrac{\varepsilon}{2})`,
  ],
  tryThis: [
    'Read the table while it runs. Each row is one paper-and-pencil step from the lecture.',
    'Set ε = 0.2 or 0.3. How badly does the computed orbit miss the exact one?',
    'Watch the red acceleration arrow. It always points at the Sun, and it is longest at closest approach.',
  ],
  create(gui) {
    const group = new THREE.Group();
    const S = 2.6;
    const toScene = (x, y, out = V()) => out.set(x * S, 0, -y * S);
    const p = { epsilon: 0.1, stepsPerSecond: 3, restart: () => reset() };

    const sun = sphere(0.22, 0xffcc33, { emissive: 0xffaa00, emissiveIntensity: 1.2 });
    const planet = sphere(0.1, 0x4fc3f7);
    const path = new Trail(600, 0xffffff, 0.9);
    const dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.04, 10, 6), mat(0xffd54f, { emissive: 0x443300 }), 600);
    dots.count = 0; dots.frustumCulled = false;
    const vA = makeArrow(0x66bb6a), aA = makeArrow(0xef5350);
    const exact = new Curve(400, 0x64b5f6, 0.4);
    {
      let x = 0.5, y = 0, vx = 0, vy = 1.63; const h = 0.0005;
      let r = Math.hypot(x, y); vx += (-x / r ** 3) * h / 2; vy += (-y / r ** 3) * h / 2;
      for (let i = 0, k = 0; i < 8200; i++) {
        x += vx * h; y += vy * h; r = Math.hypot(x, y);
        vx += (-x / r ** 3) * h; vy += (-y / r ** 3) * h;
        if (i % 21 === 0 && k < 400) { const s = toScene(x, y); exact.set(k++, s.x, s.y, s.z); }
      }
      exact.update();
    }
    group.add(sun, planet, path.line, dots, vA, aA, exact.line, floorGrid(8, 16, -0.3));

    let st, rows, acc, prev, cur, wait;
    const m = new THREE.Matrix4(), tmp = V(), tmp2 = V();
    function accel(x, y) { const r = Math.hypot(x, y); return [-x / r ** 3, -y / r ** 3, r]; }
    function reset() {
      const [ax, ay, r] = accel(0.5, 0);
      // half-step start: v(ε/2) = v(0) + (ε/2)·a(0)
      st = { t: 0, x: 0.5, y: 0, vx: 0 + ax * p.epsilon / 2, vy: 1.63 + ay * p.epsilon / 2, ax, ay, r };
      rows = [{ t: 0, x: 0.5, y: 0, vx: st.vx, vy: st.vy, ax, ay, r }];
      acc = 0; wait = 0; dots.count = 0; path.clear();
      prev = toScene(0.5, 0); cur = prev.clone();
      addDot(prev);
    }
    function addDot(s) { m.makeTranslation(s.x, s.y, s.z); dots.setMatrixAt(dots.count++, m); dots.instanceMatrix.needsUpdate = true; path.push(s); }
    function stepOnce() {
      const e = p.epsilon;
      st.x += e * st.vx; st.y += e * st.vy; st.t += e;
      const [ax, ay, r] = accel(st.x, st.y);
      st.ax = ax; st.ay = ay; st.r = r;
      st.vx += e * ax; st.vy += e * ay;
      rows.push({ t: st.t, x: st.x, y: st.y, vx: st.vx, vy: st.vy, ax, ay, r });
      prev = cur; cur = toScene(st.x, st.y);
      if (dots.count < 600) addDot(cur);
    }

    gui.add(p, 'epsilon', { '0.3 (rough)': 0.3, '0.2': 0.2, '0.1 (Feynman)': 0.1, '0.05': 0.05, '0.02': 0.02 }).name('time step ε').onChange(reset);
    gui.add(p, 'stepsPerSecond', 0.5, 30, 0.5).name('steps / second');
    gui.add(p, 'restart').name('↺ Restart');
    reset();

    return {
      group,
      update(dt) {
        if (st.t > 4.3 || st.r < 0.05 || st.r > 3) { wait += dt; if (wait > 2.5) reset(); return; }
        acc += dt * p.stepsPerSecond;
        while (acc >= 1) { acc -= 1; stepOnce(); }
        planet.position.lerpVectors(prev, cur, acc);
        setArrow(vA, planet.position, tmp.set(st.vx, 0, -st.vy), 0.5);
        setArrow(aA, planet.position, tmp2.set(st.ax, 0, -st.ay), 0.25);
      },
      readout() {
        const head = '   t      x      y     vx*    vy*     ax     ay     r';
        const body = rows.slice(-7).map((r) =>
          [r.t, r.x, r.y, r.vx, r.vy, r.ax, r.ay, r.r].map((n, i) => (i === 0 ? n.toFixed(2).padStart(5) : fmt(n, 3).padStart(7))).join(''));
        return [head, ...body, '* v at t + ε/2 (leapfrog half-step)'].join('\n');
      },
    };
  },
};

// ───────────────────────────── Vol I, Ch 26: Principle of least time ─────────────────────────────
export const leastTime = {
  id: 'feynman-least-time',
  unit: 'Vol. I · Ch. 26',
  title: 'Optics: The Principle of Least Time',
  feynman: { ref: 'Volume I, Chapter 26 — Optics: The Principle of Least Time', url: FL + 'I_26.html' },
  camera: { pos: [0, 1, 13], target: [0, 0, -1] },
  summary:
    "Light going from A in air to B in water is slower in water, so the straight line is not the fastest route. Slide the crossing point X along the surface and watch the travel time on the graph behind. The path light actually takes is the one at the minimum, and that single rule gives Snell's law. Look at the faint neighboring paths near the minimum: their times hardly change. Feynman calls the true path stationary.",
  equations: [
    String.raw`T(x) = \frac{\sqrt{(x-x_A)^2+y_A^2}}{c} + \frac{\sqrt{(x_B-x)^2+y_B^2}}{c/n}`,
    String.raw`\frac{dT}{dx}=0 \;\Longrightarrow\; \sin\theta_1 = n\sin\theta_2`,
  ],
  tryThis: [
    'Drag X by hand and try to find the minimum time before pressing "find minimum".',
    'Set n = 1 (no water). Where is the best path now?',
    'At the minimum, check that sin θ₁ / sin θ₂ in the readout equals n.',
  ],
  create(gui) {
    const group = new THREE.Group();
    const p = { x: -2, n: 1.33, bx: 3.5, by: -3, neighbors: true, findMin: () => { seeking = true; } };
    const A = V(-4, 3, 0);
    const water = box(16, 4, 4, 0x1e88e5, { transparent: true, opacity: 0.25, depthWrite: false });
    water.position.set(0, -2, 0);
    const surface = new Curve(2, 0x90caf9);
    surface.set(0, -8, 0, 0); surface.set(1, 8, 0, 0); surface.update();
    const aM = sphere(0.18, 0xffeb3b, { emissive: 0x665500 }); aM.position.copy(A);
    const bM = sphere(0.18, 0xff7043, { emissive: 0x552200 });
    const xM = sphere(0.12, 0xffffff);
    const minM = sphere(0.08, 0x66bb6a, { emissive: 0x115511 });
    const photon = sphere(0.1, 0xffffff, { emissive: 0xffffff });
    const la = textSprite('A', { height: 0.4 }); la.position.copy(A).add(V(0, 0.5, 0));
    const lb = textSprite('B', { height: 0.4 });
    const pathC = new Curve(3, 0xffeb3b);
    const NB = 25;
    const nbs = Array.from({ length: NB }, () => { const c = new Curve(3, 0xffffff, 0.25); group.add(c.line); return c; });
    const graph = new Curve(200, 0x80deea);
    const gMark = sphere(0.1, 0xffeb3b, { emissive: 0x665500 });
    const gl = textSprite('travel time T(x)', { height: 0.3 }); gl.position.set(-6, 3.4, -3);
    group.add(water, surface.line, aM, bM, xM, minM, photon, la, lb, pathC.line, graph.line, gMark, gl);

    let seeking = false, tau = 0, xmin = 0, Tmin = 0, Tmax = 1;
    const B = V();
    const T = (x) => Math.hypot(x - A.x, A.y) + p.n * Math.hypot(B.x - x, B.y);
    const gy = (t) => -2.5 + (5.5 * (t - Tmin)) / (Tmax - Tmin);
    function rebuild() {
      B.set(p.bx, p.by, 0);
      bM.position.copy(B); lb.position.copy(B).add(V(0, -0.5, 0));
      let lo = -8, hi = 8;
      for (let i = 0; i < 80; i++) { const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3; if (T(m1) < T(m2)) hi = m2; else lo = m1; }
      xmin = (lo + hi) / 2; Tmin = T(xmin); Tmax = Math.max(T(-7), T(7));
      minM.position.set(xmin, 0, 0);
      for (let i = 0; i < 200; i++) { const x = -7 + (14 * i) / 199; graph.set(i, x, gy(T(x)), -3); }
      graph.update();
      nbs.forEach((c, i) => {
        const x = -6 + (12 * i) / (NB - 1);
        c.set(0, A.x, A.y, A.z); c.set(1, x, 0, 0); c.set(2, B.x, B.y, 0); c.update();
        c.line.material.color.copy(heat(Math.min(1, (T(x) - Tmin) / 3)));
      });
    }
    gui.add(p, 'x', -7, 7, 0.01).name('crossing point X').listen().onChange(() => (seeking = false));
    gui.add(p, 'n', 1, 2.4, 0.01).name('index n (water 1.33)').onChange(rebuild);
    gui.add(p, 'bx', -6, 7, 0.1).name('B x').onChange(rebuild);
    gui.add(p, 'by', -3.8, -0.5, 0.1).name('B depth').onChange(rebuild);
    gui.add(p, 'neighbors').name('neighbor paths').onChange((v) => nbs.forEach((c) => (c.line.visible = v)));
    gui.add(p, 'findMin').name('🎯 Find minimum time');
    rebuild();

    return {
      group,
      update(dt) {
        if (seeking) { p.x += (xmin - p.x) * Math.min(1, dt * 3); if (Math.abs(p.x - xmin) < 1e-3) seeking = false; }
        const X = V(p.x, 0, 0);
        xM.position.copy(X);
        pathC.set(0, A.x, A.y, 0); pathC.set(1, p.x, 0, 0); pathC.set(2, B.x, B.y, 0); pathC.update();
        const Tx = T(p.x);
        gMark.position.set(p.x, gy(Tx), -3);
        const d1 = A.distanceTo(X);
        tau = (tau + dt * 2.5) % (Tx + 1);
        if (tau < d1) photon.position.lerpVectors(A, X, tau / d1);
        else photon.position.lerpVectors(X, B, Math.min(1, (tau - d1) / (Tx - d1)));
      },
      readout() {
        const s1 = (p.x - A.x) / Math.hypot(p.x - A.x, A.y), s2 = (B.x - p.x) / Math.hypot(B.x - p.x, B.y);
        return [
          `T(X)      ${T(p.x).toFixed(4)}   (c = 1)`,
          `T min     ${Tmin.toFixed(4)}  at x = ${xmin.toFixed(3)}  (green dot)`,
          `sinθ₁/sinθ₂ = ${(s1 / s2).toFixed(3)}   n = ${p.n.toFixed(2)}`,
          'photon slows down in the water ↓',
        ].join('\n');
      },
    };
  },
};

// ───────────────────────────── Vol I, Ch 29: Interference ─────────────────────────────
export const interference = {
  id: 'feynman-interference',
  unit: 'Vol. I · Ch. 29–30',
  title: 'Interference of Waves',
  feynman: { ref: 'Volume I, Chapter 29 — Interference (and Ch. 30 — Diffraction)', url: FL + 'I_29.html' },
  camera: { pos: [-6, 9, -14], target: [0, 0, 1.5] },
  summary:
    'Several oscillators send out waves, and the surface is their sum. In some directions the crests line up and add. In others crest meets trough and they cancel. The graph at the far edge is the time-averaged intensity. Feynman shows that a steady phase delay between the sources steers the beam without moving anything, which is how phased-array radar works. More sources give sharper beams, and that leads into diffraction gratings in Ch. 30.',
  equations: [
    String.raw`\text{Resultant} = \sum_k A\cos(\omega t - k r_k + k\alpha)`,
    String.raw`I(\theta) = I_0\,\frac{\sin^2(N\phi/2)}{\sin^2(\phi/2)},\quad \phi = \alpha + \frac{2\pi d\sin\theta}{\lambda}`,
  ],
  tryThis: [
    'With 2 sources, increase the spacing d. Do the fringes get closer together or farther apart?',
    'Set 6 sources, then sweep the phase step α. Watch the main beam swing sideways.',
    'Make the wavelength larger than the spacing. Why do the side lobes disappear?',
  ],
  create(gui) {
    const group = new THREE.Group();
    const SIZE = 12, SEG = 140;
    const p = { sources: 2, spacing: 2, wavelength: 1, phaseStep: 0, waveSpeed: 1.5 };
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
    geo.rotateX(-Math.PI / 2);
    const nV = geo.attributes.position.count;
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(nV * 3), 3));
    const surf = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.1, side: THREE.DoubleSide }));
    const screen = box(SIZE, 2.5, 0.05, 0x101820, { transparent: true, opacity: 0.8 });
    screen.position.set(0, 1.25, SIZE / 2 + 0.2);
    const ic = new Curve(240, 0xffeb3b);
    const srcMeshes = Array.from({ length: 8 }, () => { const s = sphere(0.14, 0xff7043, { emissive: 0x551100 }); group.add(s); return s; });
    group.add(surf, screen, ic.line);

    const pos = geo.attributes.position, colA = geo.attributes.color;
    const base = Float32Array.from(pos.array);
    let srcX = [];
    function layout() {
      srcX = Array.from({ length: p.sources }, (_, i) => (i - (p.sources - 1) / 2) * p.spacing);
      srcMeshes.forEach((m, i) => { m.visible = i < p.sources; if (m.visible) m.position.set(srcX[i], 0.15, -SIZE / 2 + 0.5); });
      const k = (2 * Math.PI) / p.wavelength, ph = p.phaseStep * (Math.PI / 180);
      const zS = SIZE / 2 + 0.2, vals = [];
      for (let i = 0; i < 240; i++) {
        const x = -SIZE / 2 + (SIZE * i) / 239;
        let re = 0, im = 0;
        srcX.forEach((sx, j) => { const r = Math.hypot(x - sx, zS - (-SIZE / 2 + 0.5)); const a = k * r - j * ph; re += Math.cos(a) / Math.sqrt(r); im += Math.sin(a) / Math.sqrt(r); });
        vals.push(re * re + im * im);
      }
      const mx = Math.max(...vals);
      vals.forEach((v, i) => ic.set(i, -SIZE / 2 + (SIZE * i) / 239, 0.1 + (2.2 * v) / mx, zS - 0.06));
      ic.update();
    }
    gui.add(p, 'sources', 1, 8, 1).name('number of sources').onChange(layout);
    gui.add(p, 'spacing', 0.3, 4, 0.05).name('spacing d').onChange(layout);
    gui.add(p, 'wavelength', 0.4, 3, 0.05).name('wavelength λ').onChange(layout);
    gui.add(p, 'phaseStep', -180, 180, 1).name('phase step α (°)').onChange(layout);
    gui.add(p, 'waveSpeed', 0, 4, 0.1).name('animation speed');
    layout();

    let t = 0, frame = 0;
    const c = new THREE.Color();
    return {
      group,
      update(dt) {
        t += dt * p.waveSpeed;
        const k = (2 * Math.PI) / p.wavelength, w = 2 * Math.PI, ph = p.phaseStep * (Math.PI / 180), z0 = -SIZE / 2 + 0.5;
        const amp = 0.55 / Math.sqrt(p.sources);
        for (let i = 0; i < nV; i++) {
          const x = base[3 * i], z = base[3 * i + 2];
          let h = 0;
          for (let j = 0; j < srcX.length; j++) {
            const dx = x - srcX[j], dz = z - z0, r = Math.sqrt(dx * dx + dz * dz);
            h += Math.cos(k * r - w * t - j * ph) / Math.sqrt(r + 0.6);
          }
          h *= amp;
          pos.array[3 * i + 1] = h;
          const u = clamp(0.5 + h * 0.8, 0, 1);
          c.setRGB(0.05 + 0.6 * u * u, 0.25 + 0.6 * u, 0.55 + 0.45 * u);
          colA.array[3 * i] = c.r; colA.array[3 * i + 1] = c.g; colA.array[3 * i + 2] = c.b;
        }
        pos.needsUpdate = true; colA.needsUpdate = true;
        if (frame++ % 2 === 0) geo.computeVertexNormals();
        srcMeshes.forEach((m, j) => { if (m.visible) m.position.y = 0.15 + 0.15 * Math.cos(-w * t - j * ph); });
      },
      readout() {
        const fr = p.sources > 1 ? `${((p.wavelength / p.spacing) * 180 / Math.PI).toFixed(1)}°` : '—';
        return [`N = ${p.sources}   d = ${p.spacing.toFixed(2)}   λ = ${p.wavelength.toFixed(2)}`, `fringe spacing ≈ λ/d = ${fr}`, `phase step α = ${p.phaseStep}° ${p.phaseStep ? '→ beam steered' : ''}`, 'yellow: time-averaged intensity at the screen'].join('\n');
      },
    };
  },
};

// ───────────────────────────── Vol II, Ch 4: Electrostatics — Gauss's law ─────────────────────────────
export const gauss = {
  id: 'feynman-gauss',
  unit: 'Vol. II · Ch. 4',
  title: "Electrostatics: Gauss's Law",
  feynman: { ref: 'Volume II, Chapter 4 — Electrostatics (flux of E and Gauss\'s law)', url: FL + 'II_04.html' },
  camera: { pos: [6, 5, 9], target: [0, 0, 0] },
  summary:
    'Feynman describes the flux of E as how much field "flows out" through a closed surface. The arrows show E at the surface: red where it points out, blue where it points in. The flux is calculated numerically from thousands of surface patches. However you move the charges or change the surface, the flux equals the enclosed charge divided by ε₀. A charge outside sends in exactly as much as it sends out.',
  equations: [
    String.raw`\Phi_E = \oint_S \vec E\cdot\hat n\,dA = \frac{Q_{\rm enc}}{\varepsilon_0}`,
    String.raw`\text{here } k=1:\ \ \Phi_E/4\pi = Q_{\rm enc}`,
  ],
  tryThis: [
    'Turn off "animate" and slide q₁ through the surface. The flux jumps exactly when the charge crosses.',
    'Switch to the cube. Does the shape matter?',
    'Put q₂ = −1 inside next to q₁ = +1. Arrows still poke through the surface, but what is the total flux?',
  ],
  create(gui) {
    const group = new THREE.Group();
    const p = { surface: 'sphere', size: 2.4, q1: 1, x1: 0, q2: 0, x2: 3.5, animate: true };
    const c1 = sphere(0.2, 0xef5350, { emissive: 0x551111 }), c2 = sphere(0.2, 0x42a5f5, { emissive: 0x112255 });
    const af = new ArrowField(400, 0.02);
    let shell = null;
    group.add(c1, c2, af.mesh);

    function samples(fine) {
      const out = [];
      if (p.surface === 'sphere') {
        const n = fine ? 4000 : 220, dA = (4 * Math.PI * p.size ** 2) / n;
        for (const d of fibonacciSphere(n)) out.push({ r: d.clone().multiplyScalar(p.size), n: d, dA });
      } else {
        const m = fine ? 30 : 6, a = p.size, dA = (2 * a / m) ** 2;
        for (let ax = 0; ax < 3; ax++) for (const s of [-1, 1]) for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) {
          const u = -a + (2 * a * (i + 0.5)) / m, w = -a + (2 * a * (j + 0.5)) / m;
          const r = V(), n = V();
          r.setComponent(ax, s * a); r.setComponent((ax + 1) % 3, u); r.setComponent((ax + 2) % 3, w);
          n.setComponent(ax, s);
          out.push({ r, n, dA });
        }
      }
      return out;
    }
    let coarse = [], fine = [];
    function buildSurface() {
      if (shell) { group.remove(shell); disposeObject(shell); }
      const g = p.surface === 'sphere' ? new THREE.SphereGeometry(p.size, 32, 20) : new THREE.BoxGeometry(2 * p.size, 2 * p.size, 2 * p.size);
      shell = new THREE.Group();
      shell.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x80cbc4, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide })));
      shell.add(new THREE.LineSegments(new THREE.WireframeGeometry(g), new THREE.LineBasicMaterial({ color: 0x80cbc4, transparent: true, opacity: 0.15 })));
      group.add(shell);
      coarse = samples(false); fine = samples(true);
    }
    const Q = () => [[p.q1, V(p.x1, 0, 0)], [p.q2, V(p.x2, 0.0, 0)]].filter(([q]) => q !== 0);
    const e = V(), d = V(), tmp = V();
    function E(r, qs) {
      e.set(0, 0, 0);
      for (const [q, c] of qs) { d.subVectors(r, c); const r2 = Math.max(d.lengthSq(), 1e-4); e.addScaledVector(d, q / (r2 * Math.sqrt(r2))); }
      return e;
    }
    gui.add(p, 'surface', ['sphere', 'cube']).onChange(buildSurface);
    gui.add(p, 'size', 1, 3.5, 0.05).name('surface size').onChange(buildSurface);
    gui.add(p, 'q1', -2, 2, 0.5).name('charge q₁');
    gui.add(p, 'x1', -5, 5, 0.05).name('q₁ position').listen();
    gui.add(p, 'q2', -2, 2, 0.5).name('charge q₂');
    gui.add(p, 'x2', -5, 5, 0.05).name('q₂ position');
    gui.add(p, 'animate').name('animate q₁');
    buildSurface();

    let t = 0, flux = 0, qenc = 0;
    return {
      group,
      update(dt) {
        t += dt;
        if (p.animate) p.x1 = 4.2 * Math.sin(t * 0.35);
        const qs = Q();
        c1.visible = p.q1 !== 0; c1.position.set(p.x1, 0, 0); c1.material.color.set(p.q1 > 0 ? 0xef5350 : 0x42a5f5);
        c2.visible = p.q2 !== 0; c2.position.set(p.x2, 0, 0); c2.material.color.set(p.q2 > 0 ? 0xef5350 : 0x42a5f5);
        flux = 0;
        for (const s of fine) flux += E(s.r, qs).dot(s.n) * s.dA;
        const inside = (c) => (p.surface === 'sphere' ? c.length() < p.size : Math.max(Math.abs(c.x), Math.abs(c.y), Math.abs(c.z)) < p.size);
        qenc = qs.reduce((sum, [q, c]) => sum + (inside(c) ? q : 0), 0);
        coarse.forEach((s, i) => {
          E(s.r, qs);
          const out = e.dot(s.n);
          af.set(i, s.r, e, clamp(e.length() * 1.5, 0.05, 0.9), out >= 0 ? 0xef5350 : 0x42a5f5, 1);
        });
        af.commit(coarse.length);
      },
      readout() {
        return [`Φ / 4π (numeric)   ${fmt(flux / (4 * Math.PI), 3)}`, `Q enclosed         ${fmt(qenc, 3)}`, `surface: ${p.surface}, ${fine.length} patches`, Math.abs(flux / (4 * Math.PI) - qenc) < 0.05 ? "✓ Gauss's law holds" : '(charge on the surface!)'].join('\n');
      },
    };
  },
};

// ───────────────────────────── Vol III, Ch 1: Quantum Behavior — double slit ─────────────────────────────
export const doubleSlit = {
  id: 'feynman-double-slit',
  unit: 'Vol. III · Ch. 1',
  title: 'Quantum Behavior: The Double-Slit Experiment',
  feynman: { ref: 'Volume III, Chapter 1 — Quantum Behavior (an experiment with electrons; watching the electrons)', url: FL + 'III_01.html' },
  camera: { pos: [8, 5, 13], target: [0, 0, 2] },
  summary:
    'Feynman calls this the experiment that holds the "only mystery" of quantum mechanics. Electrons arrive at the detector one at a time, as single lumps. Yet after thousands of arrivals they build an interference pattern, as if each one went through both slits. Turn on the light source to watch which slit each electron uses, and the pattern disappears into P₁ + P₂. Close one slit to compare.',
  equations: [
    String.raw`P_{12} = |\phi_1+\phi_2|^2 \neq P_1 + P_2`,
    String.raw`\text{watched: } P'_{12} = |\phi_1|^2 + |\phi_2|^2`,
    String.raw`\Delta x_{\rm fringe} \approx \frac{\lambda L}{d}`,
  ],
  tryThis: [
    'Let about 2,000 electrons arrive. Can you tell where any single one will land?',
    'Turn the light on. Which bands fill in, and why does that matter?',
    'Close slit 2, then slit 1, then open both. Is "both" the sum of the two single-slit patterns?',
  ],
  create(gui) {
    const group = new THREE.Group();
    const Lz = 6, W = 9, MAXHITS = 30000, BINS = 72;
    const p = { watching: false, rate: 60, slit1: true, slit2: true, wavelength: 0.3, separation: 1.2, showTheory: true, clear: () => clearHits() };

    const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 1, 20), mat(0x78909c, { metalness: 0.6 }));
    gun.rotation.x = Math.PI / 2; gun.position.set(0, 0, -Lz - 0.5);
    const lamp = sphere(0.25, 0xfff59d, { emissive: 0xffee58, emissiveIntensity: 0 });
    lamp.position.set(-2.5, 1.8, 0.6);
    const screen = box(W, 3.2, 0.05, 0x0d1520, { transparent: true, opacity: 0.85 });
    screen.position.set(0, 0, Lz);
    const wall = new THREE.Group();
    const lbl = textSprite('detector', { height: 0.3 }); lbl.position.set(W / 2 + 0.8, 1.4, Lz);
    group.add(gun, lamp, screen, wall, lbl);

    const hitPos = new Float32Array(MAXHITS * 3);
    const hitGeo = new THREE.BufferGeometry();
    hitGeo.setAttribute('position', new THREE.BufferAttribute(hitPos, 3));
    hitGeo.setDrawRange(0, 0);
    const hits = new THREE.Points(hitGeo, new THREE.PointsMaterial({ color: 0x80deea, size: 0.035, transparent: true, opacity: 0.9 }));
    hits.frustumCulled = false;
    const bars = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 0.12).translate(0, 0.5, 0), mat(0x4dd0e1, { emissive: 0x0a3a40 }), BINS);
    bars.frustumCulled = false;
    const theory = new Curve(300, 0xffeb3b);
    group.add(hits, bars, theory.line);

    const pool = Array.from({ length: 80 }, () => { const s = sphere(0.06, 0xe0f7fa, { emissive: 0x80deea }); s.visible = false; group.add(s); return { mesh: s, active: false }; });
    const flash = sphere(0.18, 0xffffff, { emissive: 0xfff59d, transparent: true, opacity: 0 });
    group.add(flash);

    let nHits = 0, counts = new Array(BINS).fill(0), cdf = [], P = [], Pmax = 1;
    const binW = W / BINS;
    const slitX = () => [-p.separation / 2, p.separation / 2];
    function amp(x, s) {
      const a = 0.25, u = (Math.PI * a * (x - s)) / (p.wavelength * Lz);
      const env = u === 0 ? 1 : Math.sin(u) / u;
      const ph = ((2 * Math.PI) / p.wavelength) * Math.hypot(x - s, Lz);
      return [env * Math.cos(ph), env * Math.sin(ph)];
    }
    function prob(x) {
      const [s1, s2] = slitX();
      const a1 = p.slit1 ? amp(x, s1) : [0, 0], a2 = p.slit2 ? amp(x, s2) : [0, 0];
      return p.watching ? a1[0] ** 2 + a1[1] ** 2 + a2[0] ** 2 + a2[1] ** 2 : (a1[0] + a2[0]) ** 2 + (a1[1] + a2[1]) ** 2;
    }
    function rebuild() {
      disposeObject(wall); wall.clear();
      const [s1, s2] = slitX(), a = 0.25;
      const edges = [-W / 2 - 0.5, s1 - a / 2, s1 + a / 2, s2 - a / 2, s2 + a / 2, W / 2 + 0.5];
      for (let i = 0; i < edges.length - 1; i++) {
        const isSlit = i === 1 || i === 3, open = i === 1 ? p.slit1 : p.slit2;
        if (isSlit && open) continue;
        const w = edges[i + 1] - edges[i];
        const b = box(w, 3.2, 0.15, isSlit ? 0xb71c1c : 0x546e7a);
        b.position.set((edges[i] + edges[i + 1]) / 2, 0, 0);
        wall.add(b);
      }
      cdf = []; P = [];
      let s = 0;
      for (let i = 0; i <= 600; i++) { const x = -W / 2 + (W * i) / 600; const v = prob(x); P.push(v); s += v; cdf.push(s); }
      cdf = cdf.map((v) => v / s);
      Pmax = s;
      lamp.material.emissiveIntensity = p.watching ? 2 : 0;
      clearHits();
    }
    function sampleX() {
      const u = Math.random();
      let lo = 0, hi = cdf.length - 1;
      while (lo < hi) { const m = (lo + hi) >> 1; if (cdf[m] < u) lo = m + 1; else hi = m; }
      return -W / 2 + (W * (lo + Math.random() - 0.5)) / 600;
    }
    function clearHits() { nHits = 0; counts.fill(0); hitGeo.setDrawRange(0, 0); pool.forEach((q) => { q.active = false; q.mesh.visible = false; }); }
    function emit() {
      if (!p.slit1 && !p.slit2) return;
      const q = pool.find((o) => !o.active);
      if (!q) return;
      const open = slitX().filter((_, i) => (i === 0 ? p.slit1 : p.slit2));
      q.active = true; q.mesh.visible = true; q.t = 0;
      q.slit = open[Math.floor(Math.random() * open.length)];
      q.x = sampleX(); q.y = (Math.random() - 0.5) * 2.6;
      q.flashed = false;
    }
    function land(q) {
      if (nHits < MAXHITS) { hitPos.set([q.x, q.y, Lz + 0.05], nHits * 3); nHits++; hitGeo.setDrawRange(0, nHits); hitGeo.attributes.position.needsUpdate = true; }
      const b = Math.floor((q.x + W / 2) / binW);
      if (b >= 0 && b < BINS) counts[b]++;
    }

    gui.add(p, 'watching').name('💡 light on (watch slits)').onChange(rebuild);
    gui.add(p, 'slit1').name('slit 1 open').onChange(rebuild);
    gui.add(p, 'slit2').name('slit 2 open').onChange(rebuild);
    gui.add(p, 'rate', 1, 600, 1).name('electrons / second');
    gui.add(p, 'separation', 0.6, 2.4, 0.05).name('slit separation d').onChange(rebuild);
    gui.add(p, 'wavelength', 0.15, 0.6, 0.01).name('de Broglie λ').onChange(rebuild);
    gui.add(p, 'showTheory').name('theory curve');
    gui.add(p, 'clear').name('🧹 Clear detector');
    rebuild();

    let emitAcc = 0;
    const m = new THREE.Matrix4(), from = V(), mid = V();
    return {
      group,
      update(dt) {
        emitAcc += dt * p.rate;
        while (emitAcc >= 1) { emitAcc -= 1; emit(); }
        const fast = p.rate > 150;
        for (const q of pool) {
          if (!q.active) continue;
          q.t += dt * (fast ? 4 : 1.2);
          if (q.t < 1) { from.set(0, 0, -Lz); mid.set(q.slit, q.y * 0.5, 0); q.mesh.position.lerpVectors(from, mid, q.t); }
          else if (q.t < 2) {
            if (p.watching && !q.flashed) { q.flashed = true; flash.position.set(q.slit, q.y * 0.5, 0.2); flash.material.opacity = 1; }
            mid.set(q.slit, q.y * 0.5, 0); from.set(q.x, q.y, Lz); q.mesh.position.lerpVectors(mid, from, q.t - 1);
          } else { land(q); q.active = false; q.mesh.visible = false; }
        }
        flash.material.opacity = Math.max(0, flash.material.opacity - dt * 4);
        const mx = Math.max(1, ...counts);
        for (let i = 0; i < BINS; i++) {
          m.makeScale(binW * 0.9, Math.max(1e-3, (2 * counts[i]) / mx), 1).setPosition(-W / 2 + (i + 0.5) * binW, 1.7, Lz);
          bars.setMatrixAt(i, m);
        }
        bars.instanceMatrix.needsUpdate = true;
        theory.line.visible = p.showTheory && nHits > 20;
        if (theory.line.visible) {
          const total = counts.reduce((a, b) => a + b, 0);
          for (let i = 0; i < 300; i++) {
            const k = Math.round((i / 299) * 600);
            const expected = (total * P[k] * (600 / W) * binW) / Pmax;
            theory.set(i, -W / 2 + (W * i) / 299, 1.7 + (2 * expected) / mx, Lz + 0.08);
          }
          theory.update();
        }
      },
      readout() {
        return [
          `electrons detected  ${nHits}`,
          `mode   ${p.watching ? 'WATCHED → P₁ + P₂ (no interference)' : 'unwatched → |φ₁ + φ₂|²'}`,
          `slits  ${p.slit1 ? '1' : '·'} ${p.slit2 ? '2' : '·'}    fringe ≈ λL/d = ${((p.wavelength * Lz) / p.separation).toFixed(2)}`,
        ].join('\n');
      },
    };
  },
};
