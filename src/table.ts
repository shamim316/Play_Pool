import type { Ball, Vec } from './types';
import { TABLE_W, TABLE_H, BALL_R, HEAD_X, FOOT_X } from './constants';
import { dist, v } from './math';

export interface Pocket {
  pos: Vec;
  r: number;
  corner: boolean;
}

const CO = 0.016; // corner pockets sit slightly outside the play area
export const POCKETS: Pocket[] = [
  { pos: v(-CO, -CO), r: 0.066, corner: true },
  { pos: v(TABLE_W + CO, -CO), r: 0.066, corner: true },
  { pos: v(-CO, TABLE_H + CO), r: 0.066, corner: true },
  { pos: v(TABLE_W + CO, TABLE_H + CO), r: 0.066, corner: true },
  { pos: v(TABLE_W / 2, -0.024), r: 0.058, corner: false },
  { pos: v(TABLE_W / 2, TABLE_H + 0.024), r: 0.058, corner: false },
];

export const CUE_DEFAULT: Vec = v(HEAD_X * 0.8, TABLE_H / 2);

export function inKitchen(p: Vec): boolean {
  return p.x <= HEAD_X;
}

export function insideCushions(p: Vec): boolean {
  return (
    p.x >= BALL_R && p.x <= TABLE_W - BALL_R &&
    p.y >= BALL_R && p.y <= TABLE_H - BALL_R
  );
}

function overlapsAny(p: Vec, balls: Ball[], excludeId: number): boolean {
  return balls.some(
    (b) => b.inPlay && b.id !== excludeId && dist(p, b.pos) < 2.05 * BALL_R
  );
}

/**
 * Find the closest valid position to `desired` that is inside the cushions,
 * satisfies `constraint`, and does not overlap another ball. Searches in
 * expanding rings.
 */
export function nearestFreeSpot(
  balls: Ball[],
  desired: Vec,
  constraint: (p: Vec) => boolean = () => true,
  excludeId = 0
): Vec {
  const ok = (p: Vec) =>
    insideCushions(p) && constraint(p) && !overlapsAny(p, balls, excludeId);
  if (ok(desired)) return { ...desired };
  for (let ring = 1; ring <= 60; ring++) {
    const r = ring * 0.022;
    const steps = 8 + ring * 2;
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const p = v(desired.x + Math.cos(a) * r, desired.y + Math.sin(a) * r);
      if (ok(p)) return p;
    }
  }
  return { ...desired }; // should never happen on a real table
}

function makeBall(id: number, pos: Vec): Ball {
  return { id, pos: { ...pos }, vel: v(0, 0), inPlay: true, spinTop: 0, spinSide: 0 };
}

/**
 * Rack for 8-ball: triangle at the foot spot, 8-ball in the middle of the
 * third row, back corners from different groups, everything else random.
 */
export function rackBalls(): Ball[] {
  const apex = v(FOOT_X, TABLE_H / 2);
  const dx = 2 * BALL_R * Math.cos(Math.PI / 6) * 1.005;
  const dy = 2 * BALL_R * 1.005;

  const slots: { row: number; j: number; pos: Vec }[] = [];
  for (let row = 0; row < 5; row++) {
    for (let j = 0; j <= row; j++) {
      slots.push({
        row,
        j,
        pos: v(apex.x + row * dx, apex.y + (j - row / 2) * dy),
      });
    }
  }

  const solids = shuffle([1, 2, 3, 4, 5, 6, 7]);
  const stripes = shuffle([9, 10, 11, 12, 13, 14, 15]);
  const ids = new Map<string, number>();
  ids.set('2,1', 8); // 8-ball center of row 3
  ids.set('4,0', solids.pop()!); // back corners: one of each group
  ids.set('4,4', stripes.pop()!);
  const rest = shuffle([...solids, ...stripes]);
  for (const s of slots) {
    const key = `${s.row},${s.j}`;
    if (!ids.has(key)) ids.set(key, rest.pop()!);
  }

  const balls: Ball[] = [makeBall(0, CUE_DEFAULT)];
  for (const s of slots) balls.push(makeBall(ids.get(`${s.row},${s.j}`)!, s.pos));
  balls.sort((a, b) => a.id - b.id);
  return balls;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
