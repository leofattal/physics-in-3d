# Physics in 3D

Interactive 3D physics course: **High School → College → The Feynman Lectures**. It shows
**glasses-free, eye-tracked 3D on spatial displays via [DisplayXR](https://github.com/DisplayXR)**,
including the Samsung Odyssey 3D, Acer SpatialLabs and Nubia Pad 3D. Any other browser shows it in 2D,
with an optional red/cyan anaglyph mode.

## Run

```bash
npm install
npm run dev          # http://localhost:5173
```

### Glasses-free 3D (DisplayXR)

1. Install the DisplayXR runtime and your display's plug-in from https://github.com/DisplayXR.
2. Open the app in the **DisplayXR Browser**. A normal Chrome or Safari window only shows 2D.
3. The toolbar chip turns to **"Glasses-free 3D on"**. The scene canvas is then woven per eye
   while the sidebar and text stay flat.

How it works (`src/main.js`, "DisplayXR" section): `@displayxr/inline3d` opens an inline-3D session
and `wall.addScene(canvas, onFrame)` hands over one `XRView` per eye each frame. The app renders both
into a side-by-side backing store, and the browser weaves them for the panel. The orbit camera is sent
as a camera rig (`cameraRigFromCamera`), so the orbit target sits on the glass and the runtime applies
the eye-tracked off-axis projection.

No 3D display? Click **🔴🔵 Anaglyph** and use red/cyan glasses.

## Curriculum

| Track | Lessons |
|---|---|
| 🎒 High School | Projectile motion · Pendulum & energy · Traveling/standing waves · Collisions & momentum |
| 🎓 College | Kepler orbits (equal-area wedges) · 3D electric fields · Lorentz force / E×B drift · Quantum particle in a box |
| 📘 Feynman Lectures | I-1 Atoms in Motion · I-9 Feynman's numerical orbit (his ε = 0.1 table) · I-26 Least time · I-29/30 Interference · II-4 Gauss's law · III-1 Double slit |

The Feynman lessons are original simulations built alongside the chapters. Each one links to the
free official text at https://www.feynmanlectures.caltech.edu (the text itself is not reproduced here).

## Controls

- **Desktop:** drag to orbit, scroll to zoom. `Space` pauses, `R` restarts, `C` resets the camera, `←/→` changes lesson.
- **On a 3D display:** the same mouse controls work. Moving your head looks around the scene (motion parallax).

## Adding a lesson

Create an object with `{ id, unit, title, camera, summary, equations[], tryThis[], create(gui) }` and add it to
`src/curriculum.js`. `create` returns `{ group, update(dt), readout() }`. See `src/lessons/hs.js` for examples.
