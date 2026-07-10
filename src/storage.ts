import type { Difficulty } from './types';

const KEY = 'pp_guest_stats_v1';

export interface DiffRecord {
  wins: number;
  losses: number;
  /** positive = current win streak, negative = current losing streak */
  streak: number;
}

/**
 * Guest progress kept in the browser (localStorage). When account sign-in
 * arrives (Phase 3), this whole object is merged into the player's account.
 */
export interface GuestStats {
  games: number;
  ballsPotted: number;
  fouls: number;
  shots: number;
  bestStreak: number;
  perDiff: Record<Difficulty, DiffRecord>;
}

function empty(): GuestStats {
  return {
    games: 0, ballsPotted: 0, fouls: 0, shots: 0, bestStreak: 0,
    perDiff: {
      easy: { wins: 0, losses: 0, streak: 0 },
      medium: { wins: 0, losses: 0, streak: 0 },
      hard: { wins: 0, losses: 0, streak: 0 },
    },
  };
}

export function loadStats(): GuestStats {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as GuestStats;
      return { ...empty(), ...parsed, perDiff: { ...empty().perDiff, ...parsed.perDiff } };
    }
  } catch {
    /* corrupted or blocked storage: start fresh */
  }
  return empty();
}

export function recordGame(
  diff: Difficulty,
  won: boolean,
  potted: number,
  fouls: number,
  shots: number
): GuestStats {
  const s = loadStats();
  s.games++;
  s.ballsPotted += potted;
  s.fouls += fouls;
  s.shots += shots;
  const d = s.perDiff[diff];
  if (won) {
    d.wins++;
    d.streak = d.streak > 0 ? d.streak + 1 : 1;
  } else {
    d.losses++;
    d.streak = d.streak < 0 ? d.streak - 1 : -1;
  }
  if (d.streak > s.bestStreak) s.bestStreak = d.streak;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* private browsing etc. — stats just aren't kept */
  }
  return s;
}

export function totalWins(s: GuestStats): number {
  return s.perDiff.easy.wins + s.perDiff.medium.wins + s.perDiff.hard.wins;
}
