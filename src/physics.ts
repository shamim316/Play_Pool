import type { Ball, Shot, ShotEvents, Vec } from './types';
import {
  BALL_R, TABLE_W, TABLE_H, MAX_SHOT_SPEED,
  FRICTION_C0, FRICTION_C1, RESTITUTION_BALL, RESTITUTION_CUSHION, STOP_SPEED,
} from './constants';
import { POCKETS } from './table';
import { dist, len, rotate } from './math';

export function makeShotEvents(): ShotEvents {
  return { firstContact: null, potted: [], cuePotted: false, railContacts: 0 };
}

export function strike(cue: Ball, shot: Shot): void {
  const speed = shot.power * MAX_SHOT_SPEED;
  cue.vel = {
    x: Math.cos(shot.angle) * speed,
    y: Math.sin(shot.angle) * speed,
  };
  cue.spinTop = shot.spinY * speed * 0.5;
  cue.spinSide = shot.spinX;
}

export function anyMoving(balls: Ball[]): boolean {
  return balls.some((b) => b.inPlay && len(b.vel) > STOP_SPEED);
}

export function stopAll(balls: Ball[]): void {
  for (const b of balls) {
    b.vel.x = 0;
    b.vel.y = 0;
  }
}

function nearPocketMouth(p: Vec): boolean {
  return POCKETS.some((pk) => dist(p, pk.pos) < pk.r + BALL_R * 0.5);
}

function pot(b: Ball, ev: ShotEvents): void {
  b.inPlay = false;
  b.vel = { x: 0, y: 0 };
  b.spinTop = 0;
  b.spinSide = 0;
  if (b.id === 0) ev.cuePotted = true;
  else ev.potted.push(b.id);
}

/** Advance the world by dt. Returns true if anything is still moving. */
export function stepPhysics(balls: Ball[], dt: number, ev: ShotEvents): boolean {
  // Integrate + friction + spin decay
  for (const b of balls) {
    if (!b.inPlay) continue;
    const s = len(b.vel);
    if (s > 0) {
      b.pos.x += b.vel.x * dt;
      b.pos.y += b.vel.y * dt;
      const ns = Math.max(0, s - (FRICTION_C0 + FRICTION_C1 * s) * dt);
      const k = ns / s;
      b.vel.x *= k;
      b.vel.y *= k;
    }
    b.spinTop *= Math.exp(-dt / 1.4);
    b.spinSide *= Math.exp(-dt / 1.6);
  }

  // Ball-ball collisions
  for (let i = 0; i < balls.length; i++) {
    const a = balls[i];
    if (!a.inPlay) continue;
    for (let j = i + 1; j < balls.length; j++) {
      const b = balls[j];
      if (!b.inPlay) continue;
      const dx = b.pos.x - a.pos.x;
      const dy = b.pos.y - a.pos.y;
      const d2 = dx * dx + dy * dy;
      const minD = 2 * BALL_R;
      if (d2 >= minD * minD || d2 < 1e-12) continue;

      const d = Math.sqrt(d2);
      const nx = dx / d;
      const ny = dy / d;

      // positional separation
      const overlap = (minD - d) / 2;
      a.pos.x -= nx * overlap;
      a.pos.y -= ny * overlap;
      b.pos.x += nx * overlap;
      b.pos.y += ny * overlap;

      const rvn = (b.vel.x - a.vel.x) * nx + (b.vel.y - a.vel.y) * ny;
      if (rvn >= 0) continue; // separating already

      const cue = a.id === 0 ? a : b.id === 0 ? b : null;
      let cueDirPre: Vec | null = null;
      if (cue && ev.firstContact === null) {
        const cs = len(cue.vel);
        if (cs > 1e-4) cueDirPre = { x: cue.vel.x / cs, y: cue.vel.y / cs };
      }

      // equal-mass impulse along the normal
      const jimp = (-(1 + RESTITUTION_BALL) * rvn) / 2;
      a.vel.x -= nx * jimp;
      a.vel.y -= ny * jimp;
      b.vel.x += nx * jimp;
      b.vel.y += ny * jimp;

      if (cue && ev.firstContact === null) {
        ev.firstContact = cue === a ? b.id : a.id;
        // follow / draw: kick the cue ball along (or against) its old path
        if (cueDirPre && Math.abs(cue.spinTop) > 0.01) {
          cue.vel.x += cueDirPre.x * cue.spinTop;
          cue.vel.y += cueDirPre.y * cue.spinTop;
          cue.spinTop = 0;
        }
      }
    }
  }

  // Cushions + pockets
  for (const b of balls) {
    if (!b.inPlay) continue;

    // capture
    for (const pk of POCKETS) {
      if (dist(b.pos, pk.pos) < pk.r * 0.88) {
        pot(b, ev);
        break;
      }
    }
    if (!b.inPlay) continue;

    if (!nearPocketMouth(b.pos)) {
      let bounced = false;
      if (b.pos.x < BALL_R && b.vel.x < 0) {
        b.pos.x = BALL_R;
        b.vel.x = -b.vel.x * RESTITUTION_CUSHION;
        bounced = true;
      } else if (b.pos.x > TABLE_W - BALL_R && b.vel.x > 0) {
        b.pos.x = TABLE_W - BALL_R;
        b.vel.x = -b.vel.x * RESTITUTION_CUSHION;
        bounced = true;
      }
      if (b.pos.y < BALL_R && b.vel.y < 0) {
        b.pos.y = BALL_R;
        b.vel.y = -b.vel.y * RESTITUTION_CUSHION;
        bounced = true;
      } else if (b.pos.y > TABLE_H - BALL_R && b.vel.y > 0) {
        b.pos.y = TABLE_H - BALL_R;
        b.vel.y = -b.vel.y * RESTITUTION_CUSHION;
        bounced = true;
      }
      if (bounced) {
        ev.railContacts++;
        // side english bends the rebound
        if (b.id === 0 && Math.abs(b.spinSide) > 0.02) {
          b.vel = rotate(b.vel, b.spinSide * 0.3);
          b.spinSide *= 0.55;
        }
      }
    } else {
      // ball has slipped past the cushion line near a pocket mouth:
      // if it strays far outside, drop it in the nearest pocket
      const margin = 0.07;
      if (
        b.pos.x < -margin || b.pos.x > TABLE_W + margin ||
        b.pos.y < -margin || b.pos.y > TABLE_H + margin
      ) {
        pot(b, ev);
      }
    }
  }

  return anyMoving(balls);
}

/**
 * Cast the cue-ball ray for the aiming guide.
 * Returns the travel distance and the ball that would be hit (or null for a rail).
 */
export function rayHit(
  from: Vec,
  dir: Vec,
  balls: Ball[],
  excludeId: number
): { t: number; ball: Ball | null } {
  let bestT = Infinity;
  let hit: Ball | null = null;
  for (const b of balls) {
    if (!b.inPlay || b.id === excludeId) continue;
    const fx = from.x - b.pos.x;
    const fy = from.y - b.pos.y;
    const bq = fx * dir.x + fy * dir.y;
    const c = fx * fx + fy * fy - 4 * BALL_R * BALL_R;
    const disc = bq * bq - c;
    if (disc <= 0) continue;
    const t = -bq - Math.sqrt(disc);
    if (t > 1e-6 && t < bestT) {
      bestT = t;
      hit = b;
    }
  }
  const rails: number[] = [];
  if (dir.x < -1e-9) rails.push((BALL_R - from.x) / dir.x);
  if (dir.x > 1e-9) rails.push((TABLE_W - BALL_R - from.x) / dir.x);
  if (dir.y < -1e-9) rails.push((BALL_R - from.y) / dir.y);
  if (dir.y > 1e-9) rails.push((TABLE_H - BALL_R - from.y) / dir.y);
  for (const t of rails) {
    if (t > 1e-6 && t < bestT) {
      bestT = t;
      hit = null;
    }
  }
  return { t: bestT === Infinity ? 1 : bestT, ball: hit };
}
