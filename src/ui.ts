import type { Group } from './types';
import { BALL_COLORS } from './constants';
import type { App } from './game';

const $ = (id: string) => document.getElementById(id)!;

let toastTimer = 0;

export function toast(text: string, ms = 2400): void {
  const el = $('toast');
  el.textContent = text;
  el.classList.remove('hidden', 'fade');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.add('fade'), ms);
}

export function showMenu(): void {
  $('menu').classList.remove('hidden');
  $('result').classList.add('hidden');
  for (const id of ['hud', 'powerWrap', 'spinWidget', 'btnMenu', 'toast']) {
    $(id).classList.add('hidden');
  }
}

export function showGame(app: App): void {
  $('menu').classList.add('hidden');
  $('result').classList.add('hidden');
  for (const id of ['hud', 'powerWrap', 'spinWidget', 'btnMenu']) {
    $(id).classList.remove('hidden');
  }
  ($('p1').querySelector('.pname') as HTMLElement).textContent =
    `Computer (${app.difficulty[0].toUpperCase()}${app.difficulty.slice(1)})`;
  updateHud(app);
}

export function showResult(
  app: App,
  winner: 0 | 1,
  reason: string,
  stats: { potted: number[]; fouls: number[]; shots: number[] }
): void {
  $('result').classList.remove('hidden');
  $('resTitle').textContent = winner === 0 ? '🏆 You win!' : 'Computer wins';
  $('resReason').textContent = reason;
  $('resStats').innerHTML =
    `<div><b>${stats.shots[0]}</b>Your shots</div>` +
    `<div><b>${stats.potted[0]}</b>Balls potted</div>` +
    `<div><b>${stats.fouls[0]}</b>Fouls</div>`;
  void app;
}

function groupDots(app: App, g: Group | null): string {
  if (g === null) return '';
  const ids = g === 'solid' ? [1, 2, 3, 4, 5, 6, 7] : [9, 10, 11, 12, 13, 14, 15];
  return ids
    .map((id) => {
      const alive = app.game.balls[id].inPlay;
      const c = BALL_COLORS[id];
      const style =
        g === 'stripe'
          ? `background:linear-gradient(180deg,#eee 22%,${c} 22%,${c} 78%,#eee 78%)`
          : `background:${c}`;
      return `<i style="${style}" class="${alive ? '' : 'gone'}"></i>`;
    })
    .join('');
}

export function updateHud(app: App): void {
  const game = app.game;
  $('p0').classList.toggle('active', game.current === 0);
  $('p1').classList.toggle('active', game.current === 1);

  const g0 = game.groups[0];
  const g1 = game.groups[1];
  ($('p0').querySelector('.pgroup') as HTMLElement).textContent =
    g0 === null ? '' : g0 === 'solid' ? 'Solids' : 'Stripes';
  ($('p1').querySelector('.pgroup') as HTMLElement).textContent =
    g1 === null ? '' : g1 === 'solid' ? 'Solids' : 'Stripes';
  ($('p0').querySelector('.pballs') as HTMLElement).innerHTML = groupDots(app, g0);
  ($('p1').querySelector('.pballs') as HTMLElement).innerHTML = groupDots(app, g1);

  const msg = $('turnMsg');
  if (game.winner !== null) msg.textContent = '';
  else if (app.simRunning) msg.textContent = '';
  else if (game.breakShot) msg.textContent = game.current === 0 ? 'Break!' : '';
  else if (g0 === null) msg.textContent = 'Table open';
  else if (game.remaining(game.groups[game.current]!) === 0) {
    msg.textContent = game.current === 0 ? 'Sink the 8-ball!' : '';
  } else msg.textContent = '';

  const humanTurn =
    game.current === 0 && !app.simRunning && game.winner === null && !app.aiAiming;
  $('powerWrap').classList.toggle('disabled', !humanTurn);
  $('spinWidget').classList.toggle('disabled', !humanTurn);
}

export function setPowerFill(p: number): void {
  ($('powerFill') as HTMLElement).style.height = `${Math.round(p * 100)}%`;
}

export function setSpinDot(x: number, y: number): void {
  const dot = $('spinDot') as HTMLElement;
  dot.style.left = `${50 + x * 34}%`;
  dot.style.top = `${50 + y * 34}%`;
}
