import { BALL_R } from './constants';
import { nearestFreeSpot, insideCushions } from './table';
import { clamp, dist, v } from './math';
import type { App } from './game';
import type { Renderer } from './render';
import * as ui from './ui';

export function setupInput(app: App, renderer: Renderer, canvas: HTMLCanvasElement): void {
  let draggingCue = false;
  let aiming = false;
  let aimHinted = false;

  const toWorld = (e: PointerEvent) => renderer.s2w(v(e.clientX, e.clientY));

  // setPointerCapture throws if the pointer was already released
  // (interrupted touches, synthetic events) — capture is best-effort
  const capture = (el: Element, e: PointerEvent) => {
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  canvas.addEventListener('pointerdown', (e) => {
    if (!app.canHumanAim()) return;
    capture(canvas, e);
    const p = toWorld(e);
    const game = app.game;
    if (game.ballInHand !== 'none' && dist(p, game.cue.pos) < BALL_R * 4) {
      draggingCue = true;
      return;
    }
    aiming = true;
    setAim(p);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!app.canHumanAim()) return;
    const p = toWorld(e);
    if (draggingCue) {
      const game = app.game;
      const target = v(p.x, p.y);
      if (insideCushions(target) && game.cuePlacementAllowed(target)) {
        game.cue.pos = nearestFreeSpot(game.balls, target, (q) => game.cuePlacementAllowed(q), 0);
      }
      return;
    }
    if (aiming) setAim(p);
  });

  const endPointer = () => {
    draggingCue = false;
    aiming = false;
  };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);

  function setAim(p: { x: number; y: number }): void {
    const cue = app.game.cue.pos;
    const dx = p.x - cue.x;
    const dy = p.y - cue.y;
    if (Math.hypot(dx, dy) < BALL_R * 0.5) return;
    app.aim.angle = Math.atan2(dy, dx);
    if (!aimHinted && !app.humanHasShot) {
      aimHinted = true;
      ui.toast('Now pull the glowing POWER bar down and let go to shoot', 3500);
    }
  }

  // ----- power slider -----
  const track = document.getElementById('powerTrack')!;
  let powerActive = false;

  const setPower = (e: PointerEvent) => {
    const r = track.getBoundingClientRect();
    const val = clamp((e.clientY - r.top) / r.height, 0, 1);
    app.aim.power = val;
    ui.setPowerFill(val);
  };

  track.addEventListener('pointerdown', (e) => {
    if (!app.canHumanAim()) return;
    powerActive = true;
    capture(track, e);
    setPower(e);
  });
  track.addEventListener('pointermove', (e) => {
    if (powerActive) setPower(e);
  });
  const releasePower = () => {
    if (!powerActive) return;
    powerActive = false;
    const p = app.aim.power;
    ui.setPowerFill(0);
    if (p > 0.06 && app.canHumanAim()) {
      app.fire({
        angle: app.aim.angle,
        power: clamp(p, 0.08, 1),
        spinX: app.aim.spinX,
        spinY: app.aim.spinY,
      });
    } else {
      app.aim.power = 0;
    }
  };
  track.addEventListener('pointerup', releasePower);
  track.addEventListener('pointercancel', releasePower);

  // ----- spin widget -----
  const spinBall = document.getElementById('spinBall')!;
  let spinActive = false;

  const setSpin = (e: PointerEvent) => {
    const r = spinBall.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const max = r.width / 2 - 8;
    let dx = (e.clientX - cx) / max;
    let dy = (e.clientY - cy) / max;
    const l = Math.hypot(dx, dy);
    if (l > 1) {
      dx /= l;
      dy /= l;
    }
    app.aim.spinX = dx;
    app.aim.spinY = -dy; // up on the widget = topspin
    ui.setSpinDot(dx, dy);
  };

  spinBall.addEventListener('pointerdown', (e) => {
    if (!app.canHumanAim()) return;
    spinActive = true;
    capture(spinBall, e);
    setSpin(e);
  });
  spinBall.addEventListener('pointermove', (e) => {
    if (spinActive) setSpin(e);
  });
  const endSpin = () => {
    spinActive = false;
  };
  spinBall.addEventListener('pointerup', endSpin);
  spinBall.addEventListener('pointercancel', endSpin);

  // reset the spin dot whenever a shot is fired
  app.onShotFired = () => {
    ui.setSpinDot(0, 0);
    ui.setPowerFill(0);
  };
}
