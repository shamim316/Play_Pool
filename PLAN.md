# Play Pool — Game Plan

A web-based pool & billiards game you play in the browser against a computer
opponent, with three difficulty levels and saved progress for signed-in players.

This document is the agreed plan. It is written for a non-technical owner:
every technical choice is explained in plain language.

---

## 1. What we are building

| Decision | Choice |
|---|---|
| Game modes | 8-Ball (flagship), 9-Ball, Straight Pool |
| Opponent | Computer AI only, with Easy / Medium / Hard levels |
| Visual style | 2D top-down table (like classic pool apps) |
| Devices | Desktop (mouse) and mobile (touch) |
| Sign-in | Google sign-in, offered **at the end of a game** |
| Guest play | Allowed; results kept on the player's device and merged into their account if they sign in later |
| Saved progress | Wins/losses per difficulty, detailed stats & streaks, public leaderboard, achievements & unlocks |
| Database & accounts | Supabase Cloud (free tier) |
| Hosting | Your VPS with Easypanel, on your existing domain with free HTTPS |

## 2. How the game plays

### The flow a player experiences

1. Open the website — the game loads instantly, no sign-in required.
2. Pick a game mode (8-Ball, 9-Ball, Straight Pool) and a difficulty
   (Easy, Medium, Hard).
3. Play against the computer: drag (or touch-drag) to aim, pull back to set
   power, optional spin control on the cue ball.
4. When the game ends, a results screen shows the outcome and stats, and asks:
   **"Sign in with Google to save your progress"** — with a clear
   "Continue as guest" option.
5. Guests keep their stats in the browser. The first time they sign in,
   everything they earned as a guest is moved into their account.
6. Signed-in players see their stats page, achievements, and the public
   leaderboard.

### Game rules per mode

- **8-Ball** — solids vs stripes; sink your group, then the 8-ball. Includes
  break rules, table-open state, fouls (scratch, wrong ball first), and
  ball-in-hand after fouls.
- **9-Ball** — balls must be contacted lowest-number-first; sinking the 9 wins.
  Push-out is *not* included in v1 (rarely understood by casual players).
- **Straight Pool** — sink any ball for 1 point, first to 25 points wins
  (configurable); balls re-rack when only one remains.

### The computer opponent (AI)

The AI plays by evaluating possible shots (which ball, which pocket, what
angle and power) and picking one — then a difficulty-based "human error" is
added to its aim and power so it feels like a real opponent, not a robot.

| | Easy | Medium | Hard |
|---|---|---|---|
| Aiming accuracy | Noticeably wobbly | Decent | Near-precise |
| Shot selection | Nearest easy ball | Best available pot | Plans pot **and** cue-ball position for the next shot |
| Safety play (deliberate defensive shots) | Never | Occasionally | When no good pot exists |
| Spin usage | None | Basic follow/draw | Full spin control |

**Matching the player:** the player chooses the difficulty, and after each
game the app tracks their win rate at that level. If they win (or lose) 3
games in a row, the results screen suggests moving up or down a level — the
player always stays in control of the choice.

## 3. What gets saved (the database)

Stored in Supabase Cloud; guests' data lives in their browser until they sign in.

- **Player profile** — display name (from Google), avatar, chosen cue/table
  colors (unlockables).
- **Game results** — one row per finished game: mode, difficulty, win/loss,
  balls potted, fouls, duration, date.
- **Aggregated stats** — games played, wins/losses **per mode and per
  difficulty**, current & longest win streak, total balls potted, pot accuracy.
- **Achievements** — e.g. "First Win", "Win 10 on Hard", "Clear the table in
  one turn", "5-game streak". Some achievements unlock cosmetic rewards
  (cue designs, table cloth colors).
- **Leaderboard** — public ranking of signed-in players by wins on Hard, with
  filters for mode and difficulty. Only display name and avatar are shown
  publicly; security rules (Supabase Row Level Security) ensure players can
  only write their own data.

## 4. Technology (plain-language)

- **The game itself** is a single web page using the browser's built-in
  drawing surface (HTML5 Canvas) with a custom-written 2D physics engine —
  ball rolling, friction, cushion bounces, spin, and pocket detection.
  Pool physics is specialized enough that a purpose-built engine is more
  reliable and smaller than a general-purpose one. Written in TypeScript,
  built with Vite (a standard, well-supported toolchain).
- **No app store, no install** — it loads like any website and works offline
  for guest play after first load.
- **Supabase Cloud** provides Google sign-in and the database. The free tier
  comfortably covers a hobby game (50,000 monthly active users, 500 MB
  database). Nothing to maintain on your VPS.
- **Hosting**: the game compiles to a folder of static files served by a tiny
  nginx web server in a Docker container. Easypanel builds and runs it
  directly from this GitHub repository and provides free automatic HTTPS on
  your domain. Deploying an update = pushing to GitHub and clicking
  "Deploy" (or enabling auto-deploy).

**Running costs: $0 beyond the VPS and domain you already have.**

## 5. Build phases

Each phase ends with something you can open in a browser and try.

1. **Phase 1 — Playable 8-Ball** *(the big one)*
   Table, balls, physics, aiming/power/spin controls (mouse + touch),
   full 8-ball rules, and the Medium AI. Playable end to end as a guest.
2. **Phase 2 — Three difficulties + polish**
   Easy and Hard AI, sounds, animations, results screen, difficulty
   suggestion logic, local (on-device) guest stats.
3. **Phase 3 — Accounts & progress**
   Supabase setup, Google sign-in at game end, guest-data merge, stats page,
   leaderboard, achievements & cosmetic unlocks.
4. **Phase 4 — 9-Ball and Straight Pool**
   Both new modes reuse the same table, physics, and AI; only the rules
   differ.
5. **Phase 5 — Deployment**
   Dockerfile, Easypanel app, domain + HTTPS, Google sign-in configuration.
   Delivered as a step-by-step guide (`SETUP.md`) written for you to follow
   with screenshots-level detail.

## 6. What I will need from you (only in Phases 3 & 5)

You never need to write code — each item comes with exact click-by-click
instructions when we reach it:

1. **Supabase**: create a free project at supabase.com and paste me two values
   from its settings page (the project URL and the "anon" public key — safe
   to share; the secret key is never used in the game).
2. **Google sign-in**: a one-time ~10-minute setup in Google Cloud Console to
   get a sign-in ID, pasted into Supabase.
3. **Easypanel**: create one app pointed at this GitHub repository and type
   in your chosen domain/subdomain (e.g. `pool.yourdomain.com`).

## 7. Out of scope for version 1

To keep the first version achievable, these are deliberately excluded (all
can be added later): playing against other humans (online multiplayer or
pass-and-play), 3D graphics, tournaments, chat, snooker, and native
iOS/Android apps.
