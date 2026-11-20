/**
 * Synthetic FSG-style endurance lap.
 *
 * Built from the track-layout limits of the FS Rules (chapter D, endurance):
 *   straights ≤ 80 m with hairpins at both ends (≤ 60 m with wide turns),
 *   constant turns 30–54 m diameter, hairpins ≥ 9 m outside diameter,
 *   slalom cones 7.5–12 m apart, chicanes, multiple turns, decreasing radius,
 *   track ≥ 3 m wide, ~22 km in total with one driver change.
 * The D chapter is not in the project rules file; check the numbers against
 * the 2027 rules PDF. Radii here are racing-line radii (centre-line radius
 * plus the line the driver takes through the 3 m track).
 *
 * This is not a reproduction of any real FSG track. It is a representative
 * mix that gives the typical FSG average speed of ~50–60 km/h. Edit the
 * segment list to match a real layout when one is known.
 */

export interface TrackSegment {
  /** length along the racing line [m] */
  len: number;
  /** turn radius [m], 0 = straight */
  R: number;
  label: string;
}

const deg = (a: number, R: number) => (a * Math.PI / 180) * R;

export const FSG_LIKE_LAP: TrackSegment[] = [
  { len: 75, R: 0, label: 'start straight' },
  { len: deg(180, 7), R: 7, label: 'hairpin' },
  { len: 60, R: 0, label: 'straight' },
  ...Array.from({ length: 5 }, (_, i) => ({ len: 10, R: 9, label: `slalom ${i + 1}` })),
  { len: 40, R: 0, label: 'straight' },
  { len: deg(180, 21), R: 21, label: 'constant turn Ø42' },
  { len: 70, R: 0, label: 'straight' },
  { len: deg(45, 11), R: 11, label: 'chicane in' },
  { len: deg(90, 11), R: 11, label: 'chicane mid' },
  { len: deg(45, 11), R: 11, label: 'chicane out' },
  { len: 50, R: 0, label: 'straight' },
  { len: deg(90, 26), R: 26, label: 'sweeper' },
  { len: 35, R: 0, label: 'straight' },
  { len: deg(45, 20), R: 20, label: 'decreasing radius 1' },
  { len: deg(45, 13), R: 13, label: 'decreasing radius 2' },
  { len: deg(90, 9), R: 9, label: 'decreasing radius 3' },
  { len: 77, R: 0, label: 'back straight' },
  { len: deg(180, 7), R: 7, label: 'hairpin' },
  { len: 45, R: 0, label: 'straight' },
  { len: deg(90, 15), R: 15, label: 'esses L' },
  { len: deg(90, 15), R: 15, label: 'esses R' },
  { len: 60, R: 0, label: 'straight' },
  ...Array.from({ length: 4 }, (_, i) => ({ len: 10, R: 9, label: `slalom ${i + 6}` })),
  { len: 30, R: 0, label: 'straight' },
  { len: deg(180, 18), R: 18, label: 'constant turn Ø36' },
  { len: 55, R: 0, label: 'straight' },
  { len: deg(180, 8), R: 8, label: 'hairpin' },
  { len: 40, R: 0, label: 'finish straight' },
];

export function lapLength(track: TrackSegment[]): number {
  return track.reduce((s, g) => s + g.len, 0);
}

/** Discretise to points every ds metres: returns curvature κ = 1/R per point. */
export function discretise(track: TrackSegment[], ds: number): { s: number[]; kappa: number[]; seg: number[] } {
  const s: number[] = [];
  const kappa: number[] = [];
  const seg: number[] = [];
  let pos = 0;
  track.forEach((g, gi) => {
    const n = Math.max(1, Math.round(g.len / ds));
    const step = g.len / n;
    for (let i = 0; i < n; i++) {
      s.push(pos);
      kappa.push(g.R > 0 ? 1 / g.R : 0);
      seg.push(gi);
      pos += step;
    }
  });
  return { s, kappa, seg };
}
