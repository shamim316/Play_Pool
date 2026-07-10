import './style.css';
import type { Difficulty } from './types';
import { App } from './game';
import { Renderer } from './render';
import { setupInput } from './input';
import { audio } from './audio';
import * as ui from './ui';

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const app = new App();
const renderer = new Renderer(canvas);
setupInput(app, renderer, canvas);

// ----- menu wiring -----
for (const btn of document.querySelectorAll<HTMLButtonElement>('.diff button')) {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.diff button').forEach((b) => b.classList.remove('selected'));
    btn.classList.add('selected');
    app.difficulty = btn.dataset.d as Difficulty;
  });
}
document.getElementById('btnPlay')!.addEventListener('click', () => app.startGame());
document.getElementById('btnAgain')!.addEventListener('click', () => app.startGame());
document.getElementById('btnToMenu')!.addEventListener('click', () => app.toMenu());
document.getElementById('btnMenu')!.addEventListener('click', () => app.toMenu());

const btnSuggest = document.getElementById('btnSuggest') as HTMLButtonElement;
btnSuggest.addEventListener('click', () => {
  const d = btnSuggest.dataset.diff as Difficulty | undefined;
  if (d) {
    app.difficulty = d;
    ui.syncDiffButtons(d);
    app.startGame();
  }
});

const btnSound = document.getElementById('btnSound')!;
const syncSoundIcon = () => {
  btnSound.textContent = audio.enabled ? '🔊' : '🔇';
};
btnSound.addEventListener('click', () => {
  audio.toggle();
  syncSoundIcon();
});
syncSoundIcon();
window.addEventListener('pointerdown', () => audio.unlock(), { once: true });

ui.showMenu();

// ----- main loop -----
let last = performance.now();
function frame(now: number): void {
  const dt = (now - last) / 1000;
  last = now;
  app.update(dt);
  renderer.render(app);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Debug/testing hooks (used by automated smoke tests)
declare global {
  interface Window {
    __pool?: {
      app: App;
      shoot: (angle: number, power: number) => void;
      state: () => unknown;
    };
  }
}
window.__pool = {
  app,
  shoot: (angle: number, power: number) => {
    if (app.canHumanAim()) {
      app.aim.angle = angle;
      app.fire({ angle, power, spinX: 0, spinY: 0 });
    }
  },
  state: () => ({
    screen: app.screen,
    simRunning: app.simRunning,
    current: app.game.current,
    winner: app.game.winner,
    breakShot: app.game.breakShot,
    ballInHand: app.game.ballInHand,
    groups: app.game.groups,
    balls: app.game.balls.map((b) => ({
      id: b.id,
      x: Math.round(b.pos.x * 1000) / 1000,
      y: Math.round(b.pos.y * 1000) / 1000,
      inPlay: b.inPlay,
    })),
  }),
};
