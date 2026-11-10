import * as THREE from 'three';
import { V, D2R, mat, sphere, box, makeArrow, setArrow, Trail, Curve, textSprite, heat, floorGrid, fmt } from '../lib/helpers.js';

// ───────────────────────────── 1. Projectile motion ─────────────────────────────
export const projectile = {
  id: 'projectile',
  unit: 'Kinematics',
  title: 'Projectile Motion',
  camera: { pos: [0, 4, 13], target: [-1, 1.5, 0] },
  summary:
    'Launch a ball and watch its velocity (white) split into two independent parts. The horizontal part (red) stays the same the whole time if there is no air. Gravity steadily shrinks the vertical part (green) and then flips it. The faint blue curve is the no-drag prediction.',
  equations: [
    String.raw`x(t) = v_0\cos\theta\;t`,
    String.raw`y(t) = v_0\sin\theta\;t - \tfrac12 g t^2`,
    String.raw`R = \dfrac{v_0^2\sin 2\theta}{g},\qquad H = \dfrac{v_0^2\sin^2\theta}{2g}`,
  ],
  tryThis: [
    'Find the angle that gives the longest range. Then turn on air drag. Is it still the best angle?',
    'Launch at 30° and then at 60°. Where does each one land, and why?',
    'Switch gravity to the Moon. How much farther does the ball go, and what does the formula for R predict?',
  ],
  create(gui) {
    const group = new THREE.Group();
    const S = 0.35; // metres → scene units
    const origin = new THREE.Group();
    origin.position.x = -5;
    group.add(origin, floorGrid(24, 24));

    const p = { angle: 45, speed: 12, gravity: 9.8, drag: 0, autoRepeat: true, launch: () => launch() };

    const pivot = new THREE.Group();
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.8, 20), mat(0x90a4ae, { metalness: 0.6 }));
    barrel.rotation.z = -Math.PI / 2;
    barrel.position.x = 0.4;
    pivot.add(barrel);
    origin.add(pivot, sphere(0.22, 0x546e7a));

    const ball = sphere(0.13, 0xffb300, { emissive: 0x553300 });
    const trail = new Trail(4000, 0xffd54f);
    const pred = new Curve(100, 0x64b5f6, 0.45);
    const vA = makeArrow(0xffffff), vxA = makeArrow(0xef5350), vyA = makeArrow(0x66bb6a);
    origin.add(ball, trail.line, pred.line, vA, vxA, vyA);

    const pos = V(), vel = V(), tmp = V();
    let flying = false, t = 0, wait = 0, maxH = 0, landed = null;

    function predict() {
      const th = p.angle * D2R, c = Math.cos(th), s = Math.sin(th), g = p.gravity;
      const T = (2 * p.speed * s) / g;
      for (let i = 0; i < pred.n; i++) {
        const tt = (T * i) / (pred.n - 1);
        pred.set(i, p.speed * c * tt * S, (p.speed * s * tt - 0.5 * g * tt * tt) * S, 0);
      }
      pred.update();
      pivot.rotation.z = th;
    }
    function launch() {
      const th = p.angle * D2R;
      pos.set(0, 0, 0);
      vel.set(Math.cos(th), Math.sin(th), 0).multiplyScalar(p.speed);
      flying = true; t = 0; maxH = 0; wait = 0; landed = null;
      trail.clear();
    }

    gui.add(p, 'angle', 5, 85, 1).name('angle (°)').onChange(predict);
    gui.add(p, 'speed', 2, 20, 0.5).name('speed (m/s)').onChange(predict);
    gui.add(p, 'gravity', { Earth: 9.8, Moon: 1.62, Mars: 3.71, Jupiter: 24.8 }).onChange(predict);
    gui.add(p, 'drag', 0, 0.1, 0.005).name('air drag');
    gui.add(p, 'autoRepeat').name('auto repeat');
    gui.add(p, 'launch').name('🚀 Launch');
    predict(); launch();

    return {
      group,
      update(dt) {
        if (flying) {
          const n = 8, h = dt / n;
          for (let i = 0; i < n && flying; i++) {
            const sp = vel.length();
            vel.x += -p.drag * sp * vel.x * h;
            vel.y += (-p.gravity - p.drag * sp * vel.y) * h;
            pos.addScaledVector(vel, h);
            t += h;
            maxH = Math.max(maxH, pos.y);
            if (pos.y < 0) { pos.y = 0; flying = false; landed = pos.x; }
          }
          trail.push(tmp.copy(pos).multiplyScalar(S));
        } else if (p.autoRepeat) {
          wait += dt;
          if (wait > 1.5) launch();
        }
        ball.position.copy(pos).multiplyScalar(S);
        setArrow(vA, ball.position, vel, 0.08);
        setArrow(vxA, ball.position, tmp.set(vel.x, 0, 0), 0.08);
        setArrow(vyA, ball.position, tmp.set(0, vel.y, 0), 0.08);
        vA.visible &&= flying; vxA.visible &&= flying; vyA.visible &&= flying;
      },
      readout() {
        const th = p.angle * D2R, g = p.gravity;
        return [
          `t        ${t.toFixed(2)} s`,
          `x, y     ${fmt(pos.x)}, ${fmt(pos.y)} m`,
          `vx, vy   ${fmt(vel.x)}, ${fmt(vel.y)} m/s`,
          `max h    ${maxH.toFixed(2)} m`,
          `landed   ${landed == null ? '…' : landed.toFixed(2) + ' m'}`,
          `theory   R=${((p.speed ** 2 * Math.sin(2 * th)) / g).toFixed(2)} m  H=${((p.speed * Math.sin(th)) ** 2 / (2 * g)).toFixed(2)} m`,
        ].join('\n');
      },
    };
  },
};

// ───────────────────────────── 2. Pendulum & energy ─────────────────────────────
export const pendulum = {
  id: 'pendulum',
  unit: 'Energy',
  title: 'Pendulum & Conservation of Energy',
  camera: { pos: [0.8, 2.2, 9], target: [0.8, 1.6, 0] },
  summary:
    'A swinging bob keeps trading potential energy (blue) for kinetic energy (orange) and back. Their sum (white) stays the same until you add damping. Look at the measured period too: small swings match 2π√(L/g), and large swings take longer.',
  equations: [
    String.raw`\ddot\theta = -\frac{g}{L}\sin\theta`,
    String.raw`E = \tfrac12 m L^2\dot\theta^2 + m g L(1-\cos\theta) = \text{const}`,
    String.raw`T \approx 2\pi\sqrt{L/g}\quad(\text{small angles})`,
  ],
  tryThis: [
    'Make the string 4× longer. Does the period change by 4× or by 2×?',
    'Raise the amplitude to 150°. How far is the measured period from the small-angle formula?',
    'Add damping and watch the white "total" bar. Where does the energy go?',
  ],
  create(gui) {
    const group = new THREE.Group();
    const p = { length: 2.5, amplitude: 40, gravity: 9.8, damping: 0, release: () => reset() };
    const pivot = V(-1.2, 3.6, 0);

    const support = box(2, 0.1, 0.6, 0x455a64);
    support.position.copy(pivot).add(V(0, 0.05, 0));
    const rodGeo = new THREE.CylinderGeometry(0.02, 0.02, 1, 8);
    rodGeo.translate(0, -0.5, 0);
    const rod = new THREE.Mesh(rodGeo, mat(0xcfd8dc));
    rod.position.copy(pivot);
    const bob = sphere(0.25, 0x4fc3f7, { metalness: 0.3 });
    const trail = new Trail(300, 0x4fc3f7, 0.35);
    const vA = makeArrow(0xffffff);
    group.add(support, rod, bob, trail.line, vA, floorGrid(12, 12, -0.01));

    const bars = [['KE', 0xff9800], ['PE', 0x42a5f5], ['E', 0xffffff]].map(([name, color], i) => {
      const g = new THREE.BoxGeometry(0.45, 1, 0.45);
      g.translate(0, 0.5, 0);
      const m = new THREE.Mesh(g, mat(color, { transparent: true, opacity: 0.9 }));
      m.position.set(2.3 + i * 0.7, 0, 0);
      const l = textSprite(name, { height: 0.3 });
      l.position.set(2.3 + i * 0.7, -0.3, 0);
      group.add(m, l);
      return m;
    });

    let th, om, t, E0, lastPeak, measuredT;
    const tmp = V();
    function reset() {
      th = p.amplitude * D2R; om = 0; t = 0;
      E0 = p.gravity * p.length * (1 - Math.cos(th));
      lastPeak = null; measuredT = null;
      trail.clear();
    }
    for (const [k, a, b, s] of [['length', 0.5, 3.4, 0.1], ['amplitude', 5, 170, 1], ['gravity', 1, 25, 0.1], ['damping', 0, 1, 0.01]])
      gui.add(p, k, a, b, s).onChange(k === 'damping' ? () => {} : reset);
    gui.add(p, 'release').name('↺ Release');
    reset();

    return {
      group,
      update(dt) {
        const n = 20, h = dt / n, k = p.gravity / p.length;
        for (let i = 0; i < n; i++) {
          const prev = om;
          om += (-k * Math.sin(th) - p.damping * om) * h;
          th += om * h;
          t += h;
          if (prev > 0 && om <= 0) {
            if (lastPeak != null) measuredT = t - lastPeak;
            lastPeak = t;
          }
        }
        const L = p.length;
        rod.scale.y = L;
        rod.rotation.z = th;
        bob.position.set(pivot.x + L * Math.sin(th), pivot.y - L * Math.cos(th), 0);
        trail.push(bob.position);
        setArrow(vA, bob.position, tmp.set(L * Math.cos(th) * om, L * Math.sin(th) * om, 0), 0.25);
        const KE = 0.5 * L * L * om * om, PE = p.gravity * L * (1 - Math.cos(th));
        const norm = E0 > 1e-6 ? 3 / E0 : 0;
        bars[0].scale.y = Math.max(1e-3, KE * norm);
        bars[1].scale.y = Math.max(1e-3, PE * norm);
        bars[2].scale.y = Math.max(1e-3, (KE + PE) * norm);
        this._e = { KE, PE };
      },
      readout() {
        const e = this._e || { KE: 0, PE: 0 };
        return [
          `θ          ${fmt(th / D2R, 1)}°`,
          `period    ${measuredT ? measuredT.toFixed(3) + ' s (measured)' : 'measuring…'}`,
          `2π√(L/g)  ${(2 * Math.PI * Math.sqrt(p.length / p.gravity)).toFixed(3)} s (small-angle)`,
          `KE / PE   ${e.KE.toFixed(2)} / ${e.PE.toFixed(2)} J/kg`,
          `total     ${(e.KE + e.PE).toFixed(2)} J/kg  (start ${E0.toFixed(2)})`,
        ].join('\n');
      },
    };
  },
};

// ───────────────────────────── 3. Standing waves ─────────────────────────────
export const waves = {
  id: 'waves',
  unit: 'Waves',
  title: 'Traveling & Standing Waves',
  camera: { pos: [0, 3, 9], target: [0, 0, 0] },
  summary:
    'Two identical waves travel in opposite directions, one in front of the string (red) and one behind it (blue). Their sum is the beaded string in the middle. At some points they always cancel. These are the nodes, and the result is a standing wave. A string fixed at both ends can only hold a whole number of half-wavelengths.',
  equations: [
    String.raw`y = A\sin(kx-\omega t)`,
    String.raw`\tfrac{A}{2}\sin(kx-\omega t)+\tfrac{A}{2}\sin(kx+\omega t)=A\sin kx\cos\omega t`,
    String.raw`\lambda_n = \frac{2L}{n},\qquad f_n = \frac{n v}{2L}`,
  ],
  tryThis: [
    'Count the nodes for harmonic 1, 2, 3 and so on. What is the pattern?',
    'Switch to "traveling". Every bead only moves up and down, yet the wave moves sideways. What is actually traveling?',
    'Double the wave speed. Which changes, the wavelength or the frequency?',
  ],
  create(gui) {
    const group = new THREE.Group();
    const L = 10, N = 120;
    const p = { mode: 'standing', harmonic: 3, amplitude: 0.8, waveSpeed: 2, showComponents: true };

    const beads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 12, 8), mat(0xffffff), N);
    beads.frustumCulled = false;
    const c1 = new Curve(200, 0xef5350, 0.7), c2 = new Curve(200, 0x42a5f5, 0.7);
    for (const x of [-L / 2, L / 2]) {
      const post = box(0.15, 2.4, 0.15, 0x78909c);
      post.position.set(x, 0, 0);
      group.add(post);
    }
    const nodes = [];
    for (let i = 0; i < 12; i++) {
      const n = sphere(0.1, 0xffeb3b, { emissive: 0x665500 });
      nodes.push(n); group.add(n);
    }
    group.add(beads, c1.line, c2.line);

    gui.add(p, 'mode', ['standing', 'traveling']);
    gui.add(p, 'harmonic', 1, 10, 1).name('harmonic n');
    gui.add(p, 'amplitude', 0.1, 1.5, 0.05);
    gui.add(p, 'waveSpeed', 0.5, 6, 0.1).name('wave speed');
    gui.add(p, 'showComponents').name('show components');

    const m = new THREE.Matrix4(), col = new THREE.Color();
    let t = 0;
    return {
      group,
      update(dt) {
        t += dt;
        const k = (p.harmonic * Math.PI) / L, w = k * p.waveSpeed, A = p.amplitude;
        const standing = p.mode === 'standing';
        for (let i = 0; i < N; i++) {
          const xi = (L * i) / (N - 1);
          const y = standing ? A * Math.sin(k * xi) * Math.cos(w * t) : A * Math.sin(k * xi - w * t);
          m.makeTranslation(xi - L / 2, y, 0);
          beads.setMatrixAt(i, m);
          beads.setColorAt(i, heat((y / A + 1) / 2, col));
        }
        beads.instanceMatrix.needsUpdate = true;
        beads.instanceColor.needsUpdate = true;
        for (let i = 0; i < 200; i++) {
          const xi = (L * i) / 199;
          c1.set(i, xi - L / 2, (A / 2) * Math.sin(k * xi - w * t), -0.8);
          c2.set(i, xi - L / 2, (A / 2) * Math.sin(k * xi + w * t), 0.8);
        }
        c1.update(); c2.update();
        c1.line.visible = c2.line.visible = standing && p.showComponents;
        nodes.forEach((n, i) => {
          n.visible = standing && i <= p.harmonic;
          n.position.set((i * L) / p.harmonic - L / 2, 0, 0);
        });
      },
      readout() {
        const lam = (2 * L) / p.harmonic;
        return [
          `mode         ${p.mode}`,
          `wavelength   λ = 2L/n = ${lam.toFixed(2)} m`,
          `frequency    f = v/λ = ${(p.waveSpeed / lam).toFixed(3)} Hz`,
          `nodes        ${p.mode === 'standing' ? p.harmonic + 1 : '— (none: energy flows)'}`,
        ].join('\n');
      },
    };
  },
};

// ───────────────────────────── 4. Collisions & momentum ─────────────────────────────
export const collisions = {
  id: 'collisions',
  unit: 'Momentum',
  title: 'Collisions & Conservation of Momentum',
  camera: { pos: [0, 4, 10], target: [0, 0.5, 0] },
  summary:
    'Two carts collide on a frictionless track. The arrows above them show momentum. The total is the same before and after every collision, and the yellow center-of-mass marker keeps gliding at constant speed straight through the crash. Kinetic energy is conserved only when the collision is perfectly elastic.',
  equations: [
    String.raw`m_1v_1 + m_2v_2 = m_1v_1' + m_2v_2'`,
    String.raw`e = \frac{v_2'-v_1'}{v_1-v_2}\quad(1=\text{elastic},\ 0=\text{sticky})`,
    String.raw`v_{\rm cm} = \frac{m_1v_1+m_2v_2}{m_1+m_2}`,
  ],
  tryThis: [
    'Use equal masses, an elastic collision, and m₂ at rest. What happens? (Think of Newton\'s cradle.)',
    'Set elasticity to 0. Where does the lost kinetic energy go?',
    'Make m₁ very heavy and m₂ very light. How fast does the light cart leave?',
  ],
  create(gui) {
    const group = new THREE.Group();
    const p = { m1: 1, m2: 3, v1: 3, v2: -1, elasticity: 1, restart: () => reset() };
    const track = box(18, 0.08, 1.2, 0x37474f);
    track.position.y = -0.04;
    const b1 = box(1, 1, 1, 0xef5350), b2 = box(1, 1, 1, 0x42a5f5);
    const a1 = makeArrow(0xef9a9a), a2 = makeArrow(0x90caf9), aCm = makeArrow(0xffeb3b);
    const cm = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 16), mat(0xffeb3b, { emissive: 0x554400 }));
    group.add(track, b1, b2, a1, a2, aCm, cm);

    let x1, x2, u1, u2, s1, s2, t, before, after;
    const tmp = V(), o = V();
    function reset() {
      x1 = -4; x2 = 2; u1 = p.v1; u2 = p.v2; t = 0; after = null;
      s1 = 0.35 + 0.3 * Math.cbrt(p.m1); s2 = 0.35 + 0.3 * Math.cbrt(p.m2);
      b1.scale.setScalar(s1); b2.scale.setScalar(s2);
      before = { P: p.m1 * u1 + p.m2 * u2, K: 0.5 * p.m1 * u1 * u1 + 0.5 * p.m2 * u2 * u2 };
    }
    gui.add(p, 'm1', 0.2, 10, 0.1).name('mass 1 (kg)').onChange(reset);
    gui.add(p, 'm2', 0.2, 10, 0.1).name('mass 2 (kg)').onChange(reset);
    gui.add(p, 'v1', -4, 6, 0.1).name('v₁ (m/s)').onChange(reset);
    gui.add(p, 'v2', -6, 4, 0.1).name('v₂ (m/s)').onChange(reset);
    gui.add(p, 'elasticity', 0, 1, 0.05).onChange(reset);
    gui.add(p, 'restart').name('↺ Restart');
    reset();

    return {
      group,
      update(dt) {
        t += dt;
        x1 += u1 * dt; x2 += u2 * dt;
        if (x2 - x1 <= (s1 + s2) / 2 && u1 > u2) {
          const { m1, m2, elasticity: e } = p, M = m1 + m2, P = m1 * u1 + m2 * u2;
          const n1 = (P + m2 * e * (u2 - u1)) / M, n2 = (P + m1 * e * (u1 - u2)) / M;
          u1 = n1; u2 = n2;
          after = { P: m1 * u1 + m2 * u2, K: 0.5 * m1 * u1 * u1 + 0.5 * m2 * u2 * u2 };
        }
        if (t > 8 || (Math.abs(x1) > 9.5 && Math.abs(x2) > 9.5)) reset();
        b1.position.set(x1, s1 / 2, 0);
        b2.position.set(x2, s2 / 2, 0);
        setArrow(a1, o.set(x1, s1 + 0.3, 0), tmp.set(p.m1 * u1, 0, 0), 0.25);
        setArrow(a2, o.set(x2, s2 + 0.3, 0), tmp.set(p.m2 * u2, 0, 0), 0.25);
        const xcm = (p.m1 * x1 + p.m2 * x2) / (p.m1 + p.m2);
        cm.position.set(xcm, 0.15, 0.8);
        setArrow(aCm, o.set(xcm, 0.15, 0.8), tmp.set((p.m1 * u1 + p.m2 * u2) / (p.m1 + p.m2), 0, 0), 0.5);
      },
      readout() {
        const lines = [`before   p = ${fmt(before.P)} kg·m/s   KE = ${before.K.toFixed(2)} J`];
        if (p.v1 <= p.v2) lines.push('(v₁ ≤ v₂: the carts never meet!)');
        else if (after) {
          lines.push(`after    p = ${fmt(after.P)} kg·m/s   KE = ${after.K.toFixed(2)} J`);
          lines.push(`KE lost  ${(100 * (1 - after.K / before.K)).toFixed(1)} %   momentum ✓ conserved`);
          lines.push(`v₁' = ${fmt(u1)}   v₂' = ${fmt(u2)} m/s`);
        } else lines.push('after    …waiting for impact');
        return lines.join('\n');
      },
    };
  },
};
