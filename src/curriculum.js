import * as hs from './lessons/hs.js';
import * as college from './lessons/college.js';
import * as fey from './lessons/feynman.js';
import * as atoms from './lessons/atoms.js';

export const TRACKS = [
  {
    id: 'hs',
    name: 'High School Physics',
    icon: '🎒',
    blurb: 'Motion, energy, waves and momentum: the foundations, built so you can see them.',
    lessons: [hs.projectile, hs.pendulum, hs.waves, hs.collisions],
  },
  {
    id: 'college',
    name: 'College Physics',
    icon: '🎓',
    blurb: 'Gravitation, 3D vector fields, the Lorentz force and your first wavefunction.',
    lessons: [college.orbits, college.efield, college.magnetic, college.quantumBox],
  },
  {
    id: 'atoms',
    name: 'Atoms & Molecules',
    icon: '🧪',
    blurb: 'Electron clouds you can walk around: hydrogen orbitals, hybrid orbitals, and how overlapping clouds become chemical bonds.',
    lessons: [atoms.hydrogen, atoms.hybrids, atoms.covalent, atoms.molecules],
  },
  {
    id: 'feynman',
    name: 'The Feynman Lectures in 3D',
    icon: '📘',
    blurb: 'Interactive 3D companions to The Feynman Lectures on Physics. Read the original chapters free at feynmanlectures.caltech.edu.',
    lessons: [fey.atoms, fey.numericalOrbit, fey.leastTime, fey.interference, fey.gauss, fey.doubleSlit],
  },
];

export const LESSONS = TRACKS.flatMap((t) => t.lessons.map((l) => ({ ...l, track: t })));
