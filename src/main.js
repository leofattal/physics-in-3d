import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { AnaglyphEffect } from 'three/examples/jsm/effects/AnaglyphEffect.js';
import { createInline3D } from '@displayxr/inline3d';
import { EyeCamera, cameraRigFromCamera, cameraRigComfortFactor } from '@displayxr/inline3d/three';
import GUI from 'lil-gui';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import './style.css';
import { TRACKS, LESSONS } from './curriculum.js';
import { disposeObject } from './lib/helpers.js';

// ───────── Renderer / scene ─────────
const host = document.getElementById('canvas-host');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.domElement.style.width = renderer.domElement.style.height = '100%';
host.appendChild(renderer.domElement);

const BG = new THREE.Color(0x0a0f1a);
const BG_3D = new THREE.Color(0x3b4760); // mid-tone: pure black ghosts worst on a 3D panel
const scene = new THREE.Scene();
scene.background = BG;
const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 200);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

scene.add(new THREE.HemisphereLight(0xbcd4ff, 0x1a1f2a, 1.4));
const sunLight = new THREE.DirectionalLight(0xffffff, 1.6);
sunLight.position.set(5, 10, 7);
scene.add(sunLight);

// starfield for ambience (hidden in glasses-free 3D: pixel-sized dots shimmer there)
const stars = (() => {
  const n = 1500, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(60 + Math.random() * 40);
    a.set([v.x, v.y, v.z], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(a, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ color: 0x8899bb, size: 0.15, sizeAttenuation: true }));
})();
scene.add(stars);

// All lesson content lives in `stage`.
const stage = new THREE.Group();
scene.add(stage);

// ───────── Fitting the scene to any screen ─────────
// Lesson cameras were framed for a roughly square view. On a narrower window (portrait tablet,
// phone, half-screen) pull the camera back along its own ray so the sides aren't cropped;
// wider windows already fit, so they keep the designed framing.
const DESIGN_ASPECT = 1.0;
let fitScale = 1;
const fitFor = (aspect) => Math.max(1, DESIGN_ASPECT / aspect);
function refit(scale) {
  if (Math.abs(scale - fitScale) < 1e-3) return;
  const off = camera.position.clone().sub(controls.target).multiplyScalar(scale / fitScale);
  camera.position.copy(controls.target).add(off);
  fitScale = scale;
}
// Bounding sphere of the current lesson, for the stereo comfort estimate.
const sceneBounds = new THREE.Sphere(new THREE.Vector3(), 6);
function measureScene() {
  stage.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(stage);
  if (!box.isEmpty()) box.getBoundingSphere(sceneBounds);
  sceneBounds.radius = THREE.MathUtils.clamp(sceneBounds.radius, 2, 20);
}

function resize() {
  const { clientWidth: w, clientHeight: h } = host;
  if (!w || !h) return;
  const dpr = window.devicePixelRatio || 1;
  if (woven) {
    // Side-by-side store: double width, device pixels, pixelRatio 1 (getViewport is in device px).
    renderer.setPixelRatio(1);
    renderer.setSize(Math.round(w * dpr * 2), Math.round(h * dpr), false);
  } else {
    renderer.setPixelRatio(Math.min(dpr, 2));
    renderer.setSize(w, h, false);
    anaglyph?.setSize(w, h);
  }
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  refit(fitFor(camera.aspect));
}
new ResizeObserver(resize).observe(host);

// ───────── State ─────────
let current = null, inst = null, gui = null;
let paused = false, timeScale = 1;
const progressKey = 'physics3d.completed';
const completed = new Set(JSON.parse(safeGet(progressKey) || '[]'));
function safeGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function safeSet(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } }

// ───────── Sidebar ─────────
const tracksEl = document.getElementById('tracks');
function renderSidebar() {
  tracksEl.innerHTML = TRACKS.map((t) => {
    const done = t.lessons.filter((l) => completed.has(l.id)).length;
    return `
      <section class="track">
        <h2><span>${t.icon}</span>${t.name}</h2>
        <div class="progress"><div style="width:${(100 * done) / t.lessons.length}%"></div></div>
        <p class="blurb">${t.blurb}</p>
        <ol>${t.lessons.map((l) => `
          <li><a href="#${l.id}" data-id="${l.id}" class="${current?.id === l.id ? 'active' : ''}">
            <span class="check">${completed.has(l.id) ? '✓' : ''}</span>
            <span><small>${l.unit}</small>${l.title}</span>
          </a></li>`).join('')}
        </ol>
      </section>`;
  }).join('');
}

// ───────── Lesson panel ─────────
const lessonEl = document.getElementById('lesson');
function renderLesson(l) {
  const idx = LESSONS.findIndex((x) => x.id === l.id);
  const prev = LESSONS[idx - 1], next = LESSONS[idx + 1];
  const tex = (s) => katex.renderToString(s, { displayMode: true, throwOnError: false });
  lessonEl.innerHTML = `
    <div class="crumbs">${l.track.icon} ${l.track.name} · ${l.unit}</div>
    <h2>${l.title}</h2>
    <p class="summary">${l.summary}</p>
    ${l.feynman ? `
      <a class="feynman" href="${l.feynman.url}" target="_blank" rel="noopener">
        <strong>📘 Read the original</strong>
        <span>${l.feynman.ref}</span>
        <em>feynmanlectures.caltech.edu ↗</em>
      </a>` : ''}
    <h3>Key equations</h3>
    <div class="eqs">${l.equations.map(tex).join('')}</div>
    <h3>Try this</h3>
    <ol class="try">${l.tryThis.map((s) => `<li>${s}</li>`).join('')}</ol>
    <button id="btn-done" class="${completed.has(l.id) ? 'done' : ''}">${completed.has(l.id) ? '✓ Completed' : 'Mark as complete'}</button>
    <nav class="pager">
      ${prev ? `<a href="#${prev.id}">← ${prev.title}</a>` : '<span></span>'}
      ${next ? `<a href="#${next.id}">${next.title} →</a>` : '<span></span>'}
    </nav>`;
  document.getElementById('btn-done').onclick = () => {
    completed.has(l.id) ? completed.delete(l.id) : completed.add(l.id);
    safeSet(progressKey, JSON.stringify([...completed]));
    renderLesson(l); renderSidebar();
  };
}

// ───────── Loading lessons ─────────
const guiHost = document.getElementById('gui-host');
function resetCamera() {
  if (!current) return;
  camera.position.set(...current.camera.pos);
  controls.target.set(...current.camera.target);
  fitScale = 1;
  refit(fitFor(camera.aspect));
  controls.update();
}
function load(id) {
  const l = LESSONS.find((x) => x.id === id) || LESSONS[0];
  if (inst) { stage.remove(inst.group); disposeObject(inst.group); }
  gui?.destroy();
  current = l;
  gui = new GUI({ container: guiHost, title: 'Controls' });
  if (host.clientWidth < 640) gui.close(); // small screens: controls start collapsed
  inst = l.create(gui);
  stage.add(inst.group);
  measureScene();
  resetCamera();
  renderLesson(l);
  renderSidebar();
  if (location.hash.slice(1) !== l.id) history.replaceState(null, '', '#' + l.id);
}
const step = (d) => {
  const i = LESSONS.findIndex((x) => x.id === current.id);
  location.hash = LESSONS[(i + d + LESSONS.length) % LESSONS.length].id;
};
window.addEventListener('hashchange', () => load(location.hash.slice(1)));

// ───────── Toolbar ─────────
const pauseBtn = document.getElementById('btn-pause');
const setPaused = (v) => { paused = v; pauseBtn.textContent = v ? '▶' : '⏸'; };
pauseBtn.onclick = () => setPaused(!paused);
document.getElementById('btn-reset').onclick = () => load(current.id);
document.getElementById('btn-view').onclick = resetCamera;
const focusBtn = document.getElementById('btn-focus');
const toggleFocus = () => focusBtn.classList.toggle('active', document.body.classList.toggle('focus'));
focusBtn.onclick = toggleFocus;
const speed = document.getElementById('speed'), speedVal = document.getElementById('speed-val');
speed.oninput = () => { timeScale = +speed.value; speedVal.textContent = timeScale.toFixed(1) + '×'; };
window.addEventListener('keydown', (e) => {
  if (e.target.closest('input, select, textarea')) return;
  if (e.code === 'Space') { e.preventDefault(); setPaused(!paused); }
  else if (e.key === 'r') load(current.id);
  else if (e.key === 'c') resetCamera();
  else if (e.key === 'f') toggleFocus();
  else if (e.key === 'ArrowRight') step(1);
  else if (e.key === 'ArrowLeft') step(-1);
});

// ───────── DisplayXR: glasses-free 3D ─────────
// In the DisplayXR Browser on a spatial display (Samsung Odyssey 3D, Acer SpatialLabs, …) the
// canvas becomes a woven, eye-tracked 3D window. Each frame the runtime hands us one XRView per
// eye; we render both into a side-by-side backing store and the browser weaves them for the
// panel. The orbit camera is passed in as a *camera rig*, so the orbit target sits on the glass.
// Everywhere else the page stays 2D (with an optional red/cyan anaglyph preview).
const statusEl = document.getElementById('xr-status');
const anaBtn = document.getElementById('btn-anaglyph');
const eye = new EyeCamera(THREE);
const rig = {};
let wall = null, handle = null, woven = false, anaglyph = null, conv = 0, ipd = 0.8;
let metrics = null; // this canvas on this panel, in metres (size, viewing distance)

function setStatus(text, kind = '') { statusEl.textContent = text; statusEl.dataset.kind = kind; }

// Depth adapts to the screen. The orbit target maps to the panel's nominal viewing distance
// (≈0.4 m tablet, ≈0.6 m laptop, ≈0.75 m+ big monitor), then the eye separation is lowered until
// the whole lesson fits the vergence comfort zone for THIS canvas's physical height. A small,
// close screen gets gentler depth; a large one keeps full depth.
function buildRig() {
  camera.updateMatrixWorld();
  const d = camera.position.distanceTo(controls.target);
  conv = conv ? conv + (d - conv) * 0.05 : d; // follow zoom slowly: convergence must not jump
  const viewerM = metrics?.nominalViewerM ?? 0.6;
  const m2v = conv / viewerM; // ⇒ ipd × m2v × diopters × viewer = ipd ≤ 1 (DisplayXR comfort rule)
  let target = 0.8;
  if (metrics) {
    const c = camera.position.distanceTo(sceneBounds.center);
    const k = cameraRigComfortFactor({
      zNear: Math.max(0.1, c - sceneBounds.radius), zFar: c + sceneBounds.radius,
      convergence: conv, verticalFov: THREE.MathUtils.degToRad(camera.fov), aspect: camera.aspect,
      tileHeightM: metrics.canvasSizeM[1], viewerM, metersToVirtual: m2v,
    });
    if (Number.isFinite(k) && k > 0) target = Math.min(1, 0.9 * k);
  }
  ipd += (target - ipd) * 0.1; // ease, never jump
  return cameraRigFromCamera(THREE, camera, { convergence: conv, metersToVirtual: m2v, ipdFactor: ipd, out: rig });
}

async function refreshMetrics() {
  try { metrics = await handle?.displayMetrics(); } catch { metrics = null; }
  if (!metrics || !woven) return;
  const [w, h] = metrics.displaySizeM;
  const inches = Math.hypot(w, h) / 0.0254;
  statusEl.title = `Panel ${inches.toFixed(1)}″ · view ${(metrics.canvasSizeM[0] * 100).toFixed(0)}×${(metrics.canvasSizeM[1] * 100).toFixed(0)} cm · viewing distance ${(metrics.nominalViewerM * 100).toFixed(0)} cm`;
  if (statusEl.dataset.kind === 'on') setStatus(`Glasses-free 3D on · ${inches.toFixed(1)}″`, 'on');
}

// Woven 3D looks best on a mid-tone, low-contrast backdrop with no pixel-thin detail.
function applyLook() {
  scene.background = woven ? BG_3D : BG;
  stars.visible = !woven;
}

function onFrame(views, layer) {
  tick();
  controls.update();
  handle?.setViewRig(buildRig());
  renderer.setScissorTest(false);
  renderer.clear();
  renderer.setScissorTest(true);
  for (const view of views) {
    const vp = layer.getViewport(view);
    renderer.setViewport(vp.x, vp.y, vp.width, vp.height);
    renderer.setScissor(vp.x, vp.y, vp.width, vp.height);
    eye.setFromView(view);
    renderer.render(scene, eye.camera);
  }
  renderer.setScissorTest(false);
}

function leave3D(reason) {
  woven = false; handle = null;
  applyLook(); resize();
  renderer.setAnimationLoop(loop2D);
  setStatus(reason, 'off');
}

async function initDisplayXR() {
  let w;
  try { w = await createInline3D({ lazy: false }); } catch (e) { w = { supported: false, error: e }; }
  if (!w.supported) {
    setStatus('2D · open in DisplayXR Browser for glasses-free 3D', 'off');
    return;
  }
  wall = w; woven = true;
  anaglyph = null; anaBtn.hidden = true;
  applyLook(); resize();
  renderer.setAnimationLoop(null); // the inline-3D session drives frames from now on
  handle = wall.addScene(renderer.domElement, onFrame, {
    viewRig: buildRig(),
    onLayerLost: () => leave3D('3D layer lost · showing 2D'),
    onResize: () => { resize(); refreshMetrics(); },
  });
  for (const id of ['readout', 'gui-host', 'toolbar']) handle.exclude(document.getElementById(id));
  setStatus('Glasses-free 3D on', 'on');
  refreshMetrics();
  wall.on?.('trackingstatechange', (s) => {
    if (s === 'searching') setStatus('3D · step in front of the display', 'warn');
    else { setStatus('Glasses-free 3D on', 'on'); refreshMetrics(); }
  });
}

anaBtn.onclick = () => {
  anaglyph = anaglyph ? null : new AnaglyphEffect(renderer);
  anaBtn.classList.toggle('active', !!anaglyph);
  resize();
};

// ───────── Loop ─────────
const readoutEl = document.getElementById('readout');
const timer = new THREE.Timer();
let readoutT = 0;
function tick() {
  timer.update();
  const raw = Math.min(timer.getDelta(), 1 / 30);
  if (inst && !paused) inst.update(raw * timeScale);
  if ((readoutT += raw) > 0.1 && inst?.readout) { readoutT = 0; readoutEl.textContent = inst.readout(); }
}
function loop2D() {
  tick();
  controls.update();
  if (anaglyph) {
    const d = camera.position.distanceTo(controls.target);
    anaglyph.planeDistance = d;   // orbit target sits at screen depth
    anaglyph.eyeSep = d * 0.035;
    anaglyph.render(scene, camera);
  } else renderer.render(scene, camera);
}
renderer.setAnimationLoop(loop2D);
initDisplayXR();

renderSidebar();
load(location.hash.slice(1) || LESSONS[0].id);
