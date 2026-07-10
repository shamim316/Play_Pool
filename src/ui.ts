import type { Difficulty, Group } from './types';
import { BALL_COLORS } from './constants';
import { loadStats, totalWins } from './storage';
import { ACHIEVEMENTS, type AchievementDef } from './achievements';
import { currentUser, displayName, fetchLeaderboard, isConfigured } from './cloud';
import type { App, Suggestion } from './game';

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
  for (const id of ['hud', 'powerWrap', 'spinWidget', 'btnMenu', 'btnSound', 'toast']) {
    $(id).classList.add('hidden');
  }
  $('statsPanel').classList.add('hidden');
  const s = loadStats();
  $('menuStats').textContent =
    s.games === 0
      ? ''
      : `${currentUser ? 'Your record' : 'Your record on this device'}: ` +
        `${s.games} game${s.games === 1 ? '' : 's'} · ` +
        `${totalWins(s)} won · best streak ${Math.max(0, s.bestStreak)}`;
  $('menuAccount').textContent = currentUser
    ? `Signed in as ${displayName()}`
    : '';
}

export function syncDiffButtons(diff: Difficulty): void {
  document.querySelectorAll<HTMLButtonElement>('.diff button').forEach((b) => {
    b.classList.toggle('selected', b.dataset.d === diff);
  });
}

export function showGame(app: App): void {
  $('menu').classList.add('hidden');
  $('result').classList.add('hidden');
  for (const id of ['hud', 'powerWrap', 'spinWidget', 'btnMenu', 'btnSound']) {
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
  stats: { potted: number[]; fouls: number[]; shots: number[] },
  suggest: Suggestion | null = null,
  unlocked: AchievementDef[] = []
): void {
  $('result').classList.remove('hidden');
  $('resTitle').textContent = winner === 0 ? '🏆 You win!' : 'Computer wins';
  $('resReason').textContent = reason;
  $('resStats').innerHTML =
    `<div><b>${stats.shots[0]}</b>Your shots</div>` +
    `<div><b>${stats.potted[0]}</b>Balls potted</div>` +
    `<div><b>${stats.fouls[0]}</b>Fouls</div>`;

  const ach = $('resAch');
  if (unlocked.length) {
    ach.classList.remove('hidden');
    ach.innerHTML = unlocked
      .map((a) => `<div>${a.icon} <b>${a.name}</b> — ${a.desc}</div>`)
      .join('');
  } else {
    ach.classList.add('hidden');
  }

  const note = $('resSaveNote');
  const btnGoogle = $('btnGoogle');
  if (!isConfigured()) {
    btnGoogle.classList.add('hidden');
    note.textContent = 'Playing as a guest — your progress is saved on this device.';
  } else if (currentUser) {
    btnGoogle.classList.add('hidden');
    note.textContent = `✓ Progress saved to your account (${displayName()})`;
  } else {
    btnGoogle.classList.remove('hidden');
    note.textContent = 'or keep playing as a guest — progress stays on this device';
  }

  const box = $('resSuggest');
  if (suggest) {
    box.classList.remove('hidden');
    $('resSuggestText').textContent = suggest.text;
    const btn = $('btnSuggest') as HTMLButtonElement;
    btn.textContent = `Play on ${suggest.diff[0].toUpperCase()}${suggest.diff.slice(1)}`;
    btn.dataset.diff = suggest.diff;
  } else {
    box.classList.add('hidden');
  }
  void app;
}

const DIFF_LABELS: Record<Difficulty, string> = {
  easy: 'Easy', medium: 'Medium', hard: 'Hard',
};

export function showStatsPanel(): void {
  $('statsPanel').classList.remove('hidden');
  const s = loadStats();

  $('statsAccount').innerHTML = currentUser
    ? `Signed in as <b>${escapeHtml(displayName())}</b>`
    : isConfigured()
      ? 'Playing as a guest — sign in at the end of any game to save your progress online.'
      : 'Playing as a guest — progress is saved on this device.';
  $('btnSignOut').classList.toggle('hidden', !currentUser);

  const rows = (['easy', 'medium', 'hard'] as Difficulty[])
    .map((d) => {
      const r = s.perDiff[d];
      return `<div class="statrow"><span>${DIFF_LABELS[d]}</span>` +
        `<span>${r.wins} W – ${r.losses} L</span>` +
        `<span>${r.streak > 0 ? `streak ${r.streak}` : ''}</span></div>`;
    })
    .join('');
  $('statsTable').innerHTML =
    `<div class="statrow head"><span>Difficulty</span><span>Record</span><span></span></div>` +
    rows +
    `<div class="statrow total"><span>Total</span>` +
    `<span>${totalWins(s)} W – ${s.games - totalWins(s)} L</span>` +
    `<span>${s.ballsPotted} balls potted</span></div>`;

  $('achGrid').innerHTML = ACHIEVEMENTS.map((a) => {
    const got = Boolean(s.achievements[a.id]);
    return `<div class="ach ${got ? 'got' : ''}" title="${a.desc}">` +
      `<span class="aicon">${a.icon}</span><span class="aname">${a.name}</span>` +
      `<span class="adesc">${a.desc}</span></div>`;
  }).join('');

  const lb = $('lbList');
  if (!isConfigured()) {
    lb.innerHTML = '<p class="lbnote">The leaderboard appears once the game is online with accounts enabled.</p>';
  } else {
    lb.innerHTML = '<p class="lbnote">Loading…</p>';
    void fetchLeaderboard().then((rows2) => {
      if (!rows2) {
        lb.innerHTML = '<p class="lbnote">Leaderboard unavailable right now.</p>';
      } else if (rows2.length === 0) {
        lb.innerHTML = '<p class="lbnote">No players yet — be the first to sign in and win!</p>';
      } else {
        lb.innerHTML = rows2
          .map((r, i) =>
            `<div class="statrow"><span>#${i + 1} ${escapeHtml(r.display_name ?? 'Player')}</span>` +
            `<span>${r.wins} wins</span><span>${r.games} games</span></div>`)
          .join('');
      }
    });
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
  );
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
  $('powerTrack').classList.toggle('pulse', humanTurn && !app.humanHasShot);
}

export function setPowerFill(p: number): void {
  ($('powerFill') as HTMLElement).style.height = `${Math.round(p * 100)}%`;
}

export function setSpinDot(x: number, y: number): void {
  const dot = $('spinDot') as HTMLElement;
  dot.style.left = `${50 + x * 34}%`;
  dot.style.top = `${50 + y * 34}%`;
}
