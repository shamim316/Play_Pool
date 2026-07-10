import type { Ball, Difficulty, Shot, Vec } from './types';
import { TABLE_W, TABLE_H, BALL_R, FOOT_X, HEAD_X } from './constants';
import { POCKETS } from './table';
import { EightBall } from './eightball';
import { clamp, dist, dot, gauss, norm, scale, sub, segPointDist, v } from './math';

export interface AiParams {
  angleErr: number; // std-dev of aim error, radians
  powerErr: number; // relative power error
  topChoices: number; // picks randomly among the N best shots
  breakErr: number;
}

export const AI_LEVELS: Record<Difficulty, AiParams> = {
  easy: { angleErr: 0.028, powerErr: 0.22, topChoices: 3, breakErr: 0.03 },
  medium: { angleErr: 0.011, powerErr: 0.1, topChoices: 2, breakErr: 0.012 },
  hard: { angleErr: 0.0035, powerErr: 0.04, topChoices: 1, breakErr: 0.005 },
};

interface Candidate {
  angle: number;
  power: number;
  score: number;
}

function segmentClear(a: Vec, b: Vec, balls: Ball[], exclude: number[]): boolean {
  for (const bl of balls) {
    if (!bl.inPlay || exclude.includes(bl.id)) continue;
    if (segPointDist(a, b, bl.pos) < 2 * BALL_R - 0.002) return false;
  }
  return true;
}

/** All pottable (target ball, pocket) pairs from a given cue position. */
function candidates(game: EightBall, cuePos: Vec): Candidate[] {
  const out: Candidate[] = [];
  const targets = game.legalTargets(game.current);
  for (const id of targets) {
    const t = game.balls[id];
    if (!t || !t.inPlay) continue;
    for (const pk of POCKETS) {
      const toP = sub(pk.pos, t.pos);
      const dBP = Math.hypot(toP.x, toP.y);
      if (dBP < 1e-4) continue;
      const dirBP = scale(toP, 1 / dBP);
      const ghost = sub(t.pos, scale(dirBP, 2 * BALL_R));
      const toG = sub(ghost, cuePos);
      const dCG = Math.hypot(toG.x, toG.y);
      if (dCG < BALL_R) continue;
      const dirCG = scale(toG, 1 / dCG);
      const cosCut = dot(dirCG, dirBP);
      if (cosCut < 0.2) continue; // cut too thin
      if (!segmentClear(cuePos, ghost, game.balls, [0, t.id])) continue;
      if (!segmentClear(t.pos, pk.pos, game.balls, [0, t.id])) continue;

      let score = Math.pow(cosCut, 3) / (1 + 0.6 * dCG) / (1 + 1.0 * dBP);
      if (!pk.corner) score *= Math.abs(dirBP.y); // side pockets want a square approach
      out.push({
        angle: Math.atan2(dirCG.y, dirCG.x),
        power: clamp(0.25 + 0.18 * dCG + 0.3 * (dBP / Math.max(cosCut, 0.35)), 0.22, 1),
        score,
      });
    }
  }
  return out.sort((a, b) => b.score - a.score);
}

export function chooseShot(game: EightBall, params: AiParams): Shot {
  const cuePos = game.cue.pos;

  if (game.breakShot) {
    const apex = game.balls
      .filter((b) => b.inPlay && b.id !== 0)
      .reduce((m, b) => (b.pos.x < m.pos.x ? b : m));
    const dir = norm(sub(apex.pos, cuePos));
    return {
      angle: Math.atan2(dir.y, dir.x) + gauss() * params.breakErr,
      power: 1,
      spinX: 0,
      spinY: 0,
    };
  }

  const cands = candidates(game, cuePos);
  if (cands.length > 0) {
    const n = Math.min(params.topChoices, cands.length);
    const pick = cands[Math.floor(Math.random() * n)];
    return {
      angle: pick.angle + gauss() * params.angleErr,
      power: clamp(pick.power * (1 + gauss() * params.powerErr), 0.15, 1),
      spinX: 0,
      spinY: 0,
    };
  }

  // no clean pot available: poke the nearest legal ball (simple safety)
  const targets = game.legalTargets(game.current)
    .map((id) => game.balls[id])
    .filter((b) => b && b.inPlay);
  let best: Ball | null = null;
  let bestD = Infinity;
  for (const t of targets) {
    const d = dist(cuePos, t.pos);
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  }
  const dir = best ? norm(sub(best.pos, cuePos)) : v(1, 0);
  return {
    angle: Math.atan2(dir.y, dir.x) + gauss() * params.angleErr * 2,
    power: clamp(0.3 + bestD * 0.15, 0.25, 0.6),
    spinX: 0,
    spinY: 0,
  };
}

/** Pick a good spot for ball-in-hand: the free position with the best available shot. */
export function chooseCuePlacement(game: EightBall): Vec {
  const kitchenOnly = game.ballInHand === 'kitchen';
  const xMax = kitchenOnly ? HEAD_X : TABLE_W - BALL_R * 3;
  const xs = 10;
  const ys = 6;
  let bestPos: Vec | null = null;
  let bestScore = -1;

  for (let i = 0; i < xs; i++) {
    for (let j = 0; j < ys; j++) {
      const p = v(
        BALL_R * 3 + ((xMax - BALL_R * 6) * i) / (xs - 1),
        BALL_R * 3 + ((TABLE_H - BALL_R * 6) * j) / (ys - 1)
      );
      if (game.balls.some((b) => b.inPlay && b.id !== 0 && dist(p, b.pos) < 2.3 * BALL_R)) continue;
      const cands = candidates(game, p);
      const s = cands.length ? cands[0].score : 0;
      if (s > bestScore) {
        bestScore = s;
        bestPos = p;
      }
    }
  }
  return bestPos ?? v(kitchenOnly ? HEAD_X * 0.8 : FOOT_X / 2, TABLE_H / 2);
}
