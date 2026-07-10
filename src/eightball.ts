import type { Ball, Group, ShotEvents, Vec } from './types';
import { TABLE_H, HEAD_X } from './constants';
import { rackBalls, nearestFreeSpot, inKitchen, CUE_DEFAULT } from './table';

export type BallInHand = 'none' | 'kitchen' | 'anywhere';

export interface ShotOutcome {
  foul: boolean;
  reason: string;
  keptTurn: boolean;
  gameOver: boolean;
  winner: 0 | 1 | null;
  rerack: boolean;
  assignedNow: boolean;
  pottedCount: number;
}

/**
 * 8-ball rules, kept casual-friendly:
 * - break: any first contact; pots on the break don't assign groups
 * - table stays open until a legal pot; first legal pot assigns groups
 * - fouls: no contact, wrong ball first, scratch -> opponent ball in hand
 * - 8-ball: legal only after your group is cleared; early/illegal 8 loses
 * - 8-ball on the break: re-rack, same breaker
 * (the "rail after contact" rule is intentionally omitted)
 */
export class EightBall {
  balls: Ball[];
  current: 0 | 1;
  groups: [Group | null, Group | null] = [null, null];
  breakShot = true;
  ballInHand: BallInHand = 'kitchen';
  winner: 0 | 1 | null = null;
  private legalIds: number[] = [];

  constructor(breaker: 0 | 1) {
    this.balls = rackBalls();
    this.current = breaker;
  }

  get cue(): Ball {
    return this.balls[0];
  }

  groupOf(id: number): Group | null {
    if (id >= 1 && id <= 7) return 'solid';
    if (id >= 9 && id <= 15) return 'stripe';
    return null;
  }

  remaining(g: Group): number {
    return this.balls.filter((b) => b.inPlay && this.groupOf(b.id) === g).length;
  }

  legalTargets(player: 0 | 1): number[] {
    const alive = this.balls.filter((b) => b.inPlay && b.id !== 0).map((b) => b.id);
    if (this.breakShot) return alive;
    const g = this.groups[player];
    if (g === null) return alive.filter((id) => id !== 8);
    const own = alive.filter((id) => this.groupOf(id) === g);
    return own.length ? own : [8];
  }

  /** Call right before the cue ball is struck. */
  beginShot(): void {
    this.legalIds = this.legalTargets(this.current);
    this.ballInHand = 'none';
  }

  resolve(ev: ShotEvents): ShotOutcome {
    const shooter = this.current;
    const opp = (1 - shooter) as 0 | 1;
    const potted = ev.potted;
    const wasBreak = this.breakShot;

    const out: ShotOutcome = {
      foul: false, reason: '', keptTurn: false, gameOver: false,
      winner: null, rerack: false, assignedNow: false, pottedCount: potted.length,
    };

    if (potted.includes(8)) {
      if (wasBreak) {
        out.rerack = true;
        this.balls = rackBalls();
        this.groups = [null, null];
        this.ballInHand = 'kitchen';
        return out; // same shooter breaks again
      }
      const own = this.groups[shooter];
      const pottedOwn = own === null
        ? potted.filter((id) => id !== 8).length
        : potted.filter((id) => this.groupOf(id) === own).length;
      const clearedBefore = own !== null && this.remaining(own) === 0 && pottedOwn === 0;
      const legalContact = ev.firstContact !== null && this.legalIds.includes(ev.firstContact);
      const win = clearedBefore && legalContact && !ev.cuePotted;
      this.winner = win ? shooter : opp;
      out.gameOver = true;
      out.winner = this.winner;
      out.reason = win
        ? 'Sank the 8-ball to win!'
        : ev.cuePotted
          ? 'Scratched on the 8-ball'
          : clearedBefore
            ? 'Illegal shot on the 8-ball'
            : 'Potted the 8-ball too early';
      return out;
    }

    if (ev.firstContact === null) {
      out.foul = true;
      out.reason = 'Foul: no ball contacted';
    } else if (!this.legalIds.includes(ev.firstContact)) {
      out.foul = true;
      out.reason = 'Foul: wrong ball hit first';
    }
    if (ev.cuePotted) {
      out.foul = true;
      out.reason = 'Foul: scratch!';
    }

    // group assignment on the first legal pot after the break
    if (!wasBreak && this.groups[shooter] === null && !out.foul && potted.length > 0) {
      const first = potted.find((id) => id !== 8);
      if (first !== undefined) {
        const g = this.groupOf(first)!;
        this.groups[shooter] = g;
        this.groups[opp] = g === 'solid' ? 'stripe' : 'solid';
        out.assignedNow = true;
      }
    }

    // does the shooter keep the table?
    if (!out.foul && potted.length > 0) {
      const g = this.groups[shooter];
      out.keptTurn = wasBreak || g === null || potted.some((id) => this.groupOf(id) === g);
    }

    this.breakShot = false;
    this.ballInHand = out.foul ? (wasBreak ? 'kitchen' : 'anywhere') : 'none';
    if (!out.keptTurn) this.current = opp;
    if (ev.cuePotted) this.respotCue();
    return out;
  }

  /** Put a scratched cue ball back at a sensible default; the incoming player may move it. */
  respotCue(): void {
    const desired: Vec =
      this.ballInHand === 'kitchen' ? { ...CUE_DEFAULT } : { x: HEAD_X, y: TABLE_H / 2 };
    const constraint = this.ballInHand === 'kitchen' ? inKitchen : () => true;
    const cue = this.cue;
    cue.pos = nearestFreeSpot(this.balls, desired, constraint, 0);
    cue.vel = { x: 0, y: 0 };
    cue.spinTop = 0;
    cue.spinSide = 0;
    cue.inPlay = true;
  }

  /** Is `p` a legal spot for the cue ball right now (used while dragging)? */
  cuePlacementAllowed(p: Vec): boolean {
    if (this.ballInHand === 'kitchen') return inKitchen(p);
    return this.ballInHand === 'anywhere';
  }
}
