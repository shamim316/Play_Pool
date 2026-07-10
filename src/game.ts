import type { Difficulty, Shot, ShotEvents } from './types';
import { PHYSICS_DT } from './constants';
import { EightBall } from './eightball';
import { AI_LEVELS, chooseShot, chooseCuePlacement } from './ai';
import { makeShotEvents, stepPhysics, strike, stopAll } from './physics';
import * as ui from './ui';

export type Screen = 'menu' | 'game' | 'result';

export class App {
  screen: Screen = 'menu';
  difficulty: Difficulty = 'medium';
  game: EightBall = new EightBall(0);
  simRunning = false;
  aiAiming = false;
  events: ShotEvents = makeShotEvents();
  aim = { angle: Math.PI, power: 0, spinX: 0, spinY: 0 };
  humanHasShot = false; // drives the "pull the power bar" first-shot coaching
  onShotFired: () => void = () => {};

  private accumulator = 0;
  private humanBreaks = true;
  private timers: number[] = [];
  private stats = { potted: [0, 0], fouls: [0, 0], shots: [0, 0] };

  startGame(): void {
    this.clearTimers();
    this.game = new EightBall(this.humanBreaks ? 0 : 1);
    this.simRunning = false;
    this.aiAiming = false;
    this.aim = { angle: Math.PI, power: 0, spinX: 0, spinY: 0 };
    this.humanHasShot = false;
    this.stats = { potted: [0, 0], fouls: [0, 0], shots: [0, 0] };
    this.screen = 'game';
    ui.showGame(this);
    ui.toast(this.game.current === 0 ? 'Your break!' : 'Computer breaks');
    this.onTurnStart();
  }

  toMenu(): void {
    this.clearTimers();
    this.screen = 'menu';
    this.simRunning = false;
    ui.showMenu();
  }

  canHumanAim(): boolean {
    return (
      this.screen === 'game' &&
      !this.simRunning &&
      !this.aiAiming &&
      this.game.current === 0 &&
      this.game.winner === null
    );
  }

  /** Fired by the power slider (human) or the AI. */
  fire(shot: Shot): void {
    if (this.simRunning || this.game.winner !== null) return;
    const shooter = this.game.current;
    if (shooter === 0) this.humanHasShot = true;
    this.stats.shots[shooter]++;
    this.game.beginShot();
    strike(this.game.cue, shot);
    this.events = makeShotEvents();
    this.simRunning = true;
    this.aiAiming = false;
    this.aim.power = 0;
    this.aim.spinX = 0;
    this.aim.spinY = 0;
    this.onShotFired();
    ui.updateHud(this);
  }

  /** Called from the main loop every frame. */
  update(dt: number): void {
    if (!this.simRunning) return;
    this.accumulator += Math.min(dt, 0.05);
    let moving = true;
    while (this.accumulator >= PHYSICS_DT) {
      moving = stepPhysics(this.game.balls, PHYSICS_DT, this.events);
      this.accumulator -= PHYSICS_DT;
    }
    if (!moving) {
      this.simRunning = false;
      this.accumulator = 0;
      stopAll(this.game.balls);
      this.onSettled();
    }
  }

  private onSettled(): void {
    const shooter = this.game.current;
    const out = this.game.resolve(this.events);

    this.stats.potted[shooter] += out.pottedCount;
    if (out.foul) this.stats.fouls[shooter]++;

    if (out.rerack) {
      ui.toast('8-ball on the break — re-racking!');
      ui.updateHud(this);
      this.onTurnStart();
      return;
    }

    if (out.gameOver) {
      ui.updateHud(this);
      this.after(900, () => {
        this.screen = 'result';
        ui.showResult(this, out.winner!, out.reason, this.stats);
        this.humanBreaks = out.winner === 0; // winner breaks next game
      });
      return;
    }

    if (out.foul) {
      ui.toast(out.reason + ' — ball in hand');
    } else if (out.assignedNow) {
      const g = this.game.groups[shooter]!;
      const who = shooter === 0 ? 'You are' : 'Computer is';
      ui.toast(`${who} ${g === 'solid' ? 'SOLIDS' : 'STRIPES'}`);
    } else if (out.keptTurn && out.pottedCount > 0) {
      ui.toast(shooter === 0 ? 'Nice — shoot again!' : 'Computer shoots again');
    }

    ui.updateHud(this);
    this.onTurnStart();
  }

  private onTurnStart(): void {
    ui.updateHud(this);
    if (this.game.winner !== null) return;
    if (this.game.current === 1) {
      this.aiAiming = false;
      this.after(900, () => this.aiAct());
    } else if (this.game.ballInHand !== 'none') {
      ui.toast('Ball in hand — drag the white ball to place it');
    }
  }

  private aiAct(): void {
    const game = this.game;
    if (game.winner !== null || game.current !== 1) return;

    if (game.ballInHand !== 'none') {
      game.cue.pos = chooseCuePlacement(game);
      game.cue.inPlay = true;
    }

    const shot = chooseShot(game, AI_LEVELS[this.difficulty]);
    this.aim.angle = shot.angle;
    this.aim.power = 0;
    this.aiAiming = true;

    // brief aiming animation: line up, pull back, fire
    this.after(650, () => {
      this.aim.power = shot.power;
      this.after(380, () => this.fire(shot));
    });
  }

  private after(ms: number, fn: () => void): void {
    this.timers.push(window.setTimeout(fn, ms));
  }

  private clearTimers(): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
  }
}
