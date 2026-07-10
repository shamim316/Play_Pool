import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { Difficulty } from './types';
import { loadStats, saveStats, totalWins, type GuestStats } from './storage';

/**
 * Supabase connection. The URL and anon key come from build-time env vars
 * (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY, set in Easypanel) or from
 * window globals for ad-hoc hosting. Without them the game runs entirely
 * in guest mode — every cloud call below quietly does nothing.
 */
const w = window as unknown as Record<string, unknown>;
const SUPA_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ??
  (w.PP_SUPABASE_URL as string | undefined);
const SUPA_KEY =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ??
  (w.PP_SUPABASE_ANON_KEY as string | undefined);

let client: SupabaseClient | null = null;

export function isConfigured(): boolean {
  return Boolean(SUPA_URL && SUPA_KEY);
}

function supa(): SupabaseClient | null {
  if (!SUPA_URL || !SUPA_KEY) return null;
  client ??= createClient(SUPA_URL, SUPA_KEY);
  return client;
}

export let currentUser: User | null = null;

export function displayName(u: User | null = currentUser): string {
  const meta = (u?.user_metadata ?? {}) as Record<string, unknown>;
  return (meta.full_name as string) || (meta.name as string) || u?.email || 'Player';
}

export function initAuth(onChange: (user: User | null) => void): void {
  const c = supa();
  if (!c) return;
  c.auth.onAuthStateChange((_event, session) => {
    const was = currentUser?.id;
    currentUser = session?.user ?? null;
    if (currentUser && currentUser.id !== was) {
      void afterSignIn(currentUser).finally(() => onChange(currentUser));
    } else {
      onChange(currentUser);
    }
  });
}

export function signInWithGoogle(): void {
  void supa()?.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + window.location.pathname },
  });
}

export async function signOut(): Promise<void> {
  await supa()?.auth.signOut();
}

/**
 * First sign-in on this device: everything earned as a guest is added into
 * the account. Later sign-ins take element-wise maximums instead, so nothing
 * is double-counted but progress is never lost.
 */
async function afterSignIn(u: User): Promise<void> {
  const c = supa();
  if (!c) return;
  try {
    const flag = `pp_merged_${u.id}`;
    const { data: row } = await c
      .from('player_stats')
      .select('data')
      .eq('user_id', u.id)
      .maybeSingle();
    const cloud = (row?.data as GuestStats | undefined) ?? null;
    const local = loadStats();
    const firstMerge = !localStorage.getItem(flag);
    const merged = cloud ? mergeStats(cloud, local, firstMerge ? 'sum' : 'max') : local;
    try {
      localStorage.setItem(flag, '1');
    } catch {
      /* storage unavailable */
    }
    saveStats(merged);
    await pushStats(merged);
  } catch {
    /* offline or tables missing: stay in guest mode */
  }
}

export function mergeStats(a: GuestStats, b: GuestStats, mode: 'sum' | 'max'): GuestStats {
  const num = (x: number, y: number) => (mode === 'sum' ? x + y : Math.max(x, y));
  const diffs: Difficulty[] = ['easy', 'medium', 'hard'];
  const out: GuestStats = {
    games: num(a.games, b.games),
    ballsPotted: num(a.ballsPotted, b.ballsPotted),
    fouls: num(a.fouls, b.fouls),
    shots: num(a.shots, b.shots),
    bestStreak: Math.max(a.bestStreak, b.bestStreak),
    perDiff: { ...a.perDiff },
    achievements: { ...a.achievements, ...b.achievements },
  };
  for (const d of diffs) {
    out.perDiff[d] = {
      wins: num(a.perDiff[d].wins, b.perDiff[d].wins),
      losses: num(a.perDiff[d].losses, b.perDiff[d].losses),
      streak: b.perDiff[d].streak, // most recent activity wins
    };
  }
  return out;
}

export async function pushStats(s: GuestStats): Promise<void> {
  const c = supa();
  if (!c || !currentUser) return;
  try {
    await c.from('player_stats').upsert({
      user_id: currentUser.id,
      data: { ...s, totalWins: totalWins(s) },
      updated_at: new Date().toISOString(),
    });
  } catch {
    /* offline: local copy still has everything */
  }
}

export async function recordCloudGame(g: {
  difficulty: Difficulty;
  won: boolean;
  potted: number;
  fouls: number;
  shots: number;
}): Promise<void> {
  const c = supa();
  if (!c || !currentUser) return;
  try {
    await c.from('game_results').insert({
      user_id: currentUser.id,
      mode: '8ball',
      difficulty: g.difficulty,
      won: g.won,
      balls_potted: g.potted,
      fouls: g.fouls,
      shots: g.shots,
    });
  } catch {
    /* non-fatal */
  }
}

export interface LeaderboardRow {
  display_name: string;
  wins: number;
  games: number;
  best_streak: number;
}

export async function fetchLeaderboard(): Promise<LeaderboardRow[] | null> {
  const c = supa();
  if (!c) return null;
  try {
    const { data, error } = await c
      .from('leaderboard')
      .select('display_name, wins, games, best_streak')
      .order('wins', { ascending: false })
      .limit(20);
    if (error) return null;
    return (data ?? []) as LeaderboardRow[];
  } catch {
    return null;
  }
}
