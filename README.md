# Physics in 3D

Interactive 3D physics course: **High School → College → The Feynman Lectures**. It shows
**glasses-free, eye-tracked 3D on spatial displays via [DisplayXR](https://github.com/DisplayXR)**,
including the Samsung Odyssey 3D, Acer SpatialLabs and Nubia Pad 3D. Any other browser shows it in 2D,
with an optional red/cyan anaglyph mode.

**Live:** https://3dlaern.vercel.app. Every push to `main` deploys automatically through Vercel's GitHub integration.

## Screen sizes

- **3D depth per panel:** the canvas is a window onto the lesson (a display rig), so the orbit target always sits on
  the glass, whatever the window size or zoom. DisplayXR reports the canvas's physical size and the panel's nominal
  viewing distance; eye separation is lowered only when a lesson would reach outside the vergence comfort zone
  (`comfortDepthFactor`). A 3D tablet held close gets gentler depth; a 27″ monitor keeps full depth.
- **Framing:** narrow or portrait views pull the camera back so lessons aren't cropped at the sides.
- **Layout:** three columns on desktop; lesson text moves under the view on laptops and tablets; everything stacks on
  phones (3D view → lesson → lesson list). Press **F** (or ⛶) for focus mode, which gives the 3D view the whole screen.

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
into a side-by-side backing store, and the browser weaves them for the panel. Every lesson is a subject you
turn, so it uses a **display rig** (`displayRig`): the canvas is a window posed at the orbit target,
facing the orbit camera and as tall as the camera's view there. The target sits on the glass, the
framing matches 2D, and the runtime places the eyes from the tracked head. Orbiting turns the lesson
behind a fixed window; there is no convergence distance to keep in sync.

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
- **Idle:** after 8 s without input the view orbits slowly; any click, scroll or key stops it. Off when the system asks
  for reduced motion.

## Adding a lesson

Create an object with `{ id, unit, title, camera, summary, equations[], tryThis[], create(gui) }` and add it to
`src/curriculum.js`. `create` returns `{ group, update(dt), readout() }`. See `src/lessons/hs.js` for examples.
