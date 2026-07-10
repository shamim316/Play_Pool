import type { Difficulty } from './types';
import { saveStats, totalWins, type GuestStats } from './storage';

export interface GameCtx {
  won: boolean;
  diff: Difficulty;
  potted: number;
  fouls: number;
}

export interface AchievementDef {
  id: string;
  icon: string;
  name: string;
  desc: string;
  test: (s: GuestStats, g: GameCtx) => boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_win', icon: '🏆', name: 'First Win', desc: 'Win your first game', test: (s) => totalWins(s) >= 1 },
  { id: 'clean_win', icon: '✨', name: 'Clean Sweep', desc: 'Win a game without a single foul', test: (_s, g) => g.won && g.fouls === 0 },
  { id: 'sharp', icon: '🎯', name: 'Sharp Shooter', desc: 'Pot 8 or more balls in one winning game', test: (_s, g) => g.won && g.potted >= 8 },
  { id: 'streak3', icon: '🔥', name: 'Hat-Trick', desc: 'Win 3 games in a row', test: (s) => s.bestStreak >= 3 },
  { id: 'streak5', icon: '☄️', name: 'On Fire', desc: 'Win 5 games in a row', test: (s) => s.bestStreak >= 5 },
  { id: 'wins10', icon: '🥇', name: 'Ten Up', desc: 'Win 10 games in total', test: (s) => totalWins(s) >= 10 },
  { id: 'hard_win', icon: '💪', name: 'Hard Boiled', desc: 'Beat the computer on Hard', test: (s) => s.perDiff.hard.wins >= 1 },
  { id: 'hard10', icon: '👑', name: 'Table Master', desc: 'Win 10 games on Hard', test: (s) => s.perDiff.hard.wins >= 10 },
  { id: 'potted100', icon: '💯', name: 'Century', desc: 'Pot 100 balls in total', test: (s) => s.ballsPotted >= 100 },
  { id: 'games25', icon: '🎱', name: 'Regular', desc: 'Play 25 games', test: (s) => s.games >= 25 },
];

/** Check for newly earned achievements, record them, and return them. */
export function unlockAchievements(s: GuestStats, g: GameCtx): AchievementDef[] {
  const fresh = ACHIEVEMENTS.filter((a) => !s.achievements[a.id] && a.test(s, g));
  if (fresh.length) {
    const now = Date.now();
    for (const a of fresh) s.achievements[a.id] = now;
    saveStats(s);
  }
  return fresh;
}
