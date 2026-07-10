# Setting up accounts (Supabase + Google sign-in)

Follow these steps in order. Nothing here requires coding — it's all clicking
and copy-pasting. Total time: about 15 minutes.

When you're done, you'll have **two values to send back** (Step 5). Both are
safe to share — the "anon public" key is designed to be visible in a website.

---

## Step 1 — Create the Supabase project (~3 min)

1. Go to **https://supabase.com** and click **Start your project**.
   Sign in (easiest: "Continue with GitHub" or Google).
2. Click **New project**.
3. Fill in:
   - **Name**: `play-pool` (or anything you like)
   - **Database password**: click **Generate a password** and save it
     somewhere safe (you won't need it day-to-day, but keep it).
   - **Region**: pick the one closest to your players (or to your VPS).
4. Click **Create new project** and wait ~2 minutes while it sets up.

## Step 2 — Create the database tables (~2 min)

1. In your new project, open **SQL Editor** in the left sidebar.
2. Click **New query**.
3. Open the file `supabase/schema.sql` from this repository
   (on GitHub: repository → `supabase` folder → `schema.sql` → the "copy" icon).
4. Paste the whole thing into the editor and click **Run** (bottom right).
5. You should see **"Success. No rows returned"**. That's correct.

## Step 3 — Set up Google sign-in (~8 min, one time only)

Google requires a (free) "OAuth client" so players can sign in with their
Google account.

**Part A — in Supabase (get the callback address):**

1. In Supabase, go to **Authentication → Sign In / Up → Auth Providers** and click **Google**.
2. Keep this page open. Note the **Callback URL** shown there — it looks like
   `https://xxxxxxxx.supabase.co/auth/v1/callback`. You'll paste it into
   Google in a moment.

**Part B — in Google Cloud:**

1. Go to **https://console.cloud.google.com** and sign in with your Google account.
2. At the top-left project picker, click **New project**. Name: `play-pool`. Create and select it.
3. In the search bar, type **"OAuth consent screen"** (under "APIs & Services") and open it. Choose **Get started**:
   - App name: `Play Pool`
   - User support email: your email
   - Audience: **External**
   - Contact email: your email → **Finish/Create**
4. Now search for **"Credentials"** (APIs & Services → Credentials):
   - Click **+ Create credentials → OAuth client ID**
   - Application type: **Web application**
   - Name: `play-pool-web`
   - Under **Authorized redirect URIs**, click **+ Add URI** and paste the
     **Callback URL** from Supabase (Part A).
   - Click **Create**.
5. A box appears with a **Client ID** and **Client Secret**. Keep it open.

**Part C — back in Supabase:**

1. On the Google provider page from Part A, switch **Enable Sign in with Google** on.
2. Paste the **Client ID** and **Client Secret** from Google.
3. Click **Save**.

## Step 4 — Tell Supabase where the game lives (~1 min)

1. In Supabase, go to **Authentication → URL Configuration**.
2. Set **Site URL** to where the game will run, e.g. `https://pool.yourdomain.com`
   (use your real (sub)domain — this can be updated any time).
3. Under **Redirect URLs**, click **Add URL** and add the same address.

## Step 5 — Send me the two values (~1 min)

1. In Supabase, open **Project Settings** (gear icon) → **Data API** — or the
   page called **API Keys** on newer dashboards.
2. Copy these two values and paste them into the chat:
   - **Project URL** — looks like `https://xxxxxxxx.supabase.co`
   - **anon / public key** — a long string starting with `eyJ…` or `sb_publishable_…`

That's it. Once I have those, I wire them into the game's deployment settings
and sign-in goes live. (Do **not** send the `service_role` / secret key —
the game never uses it.)

---

### How the pieces fit together

- **Supabase** stores accounts, game results, aggregated stats, and the
  leaderboard. The free tier is more than enough for a hobby game.
- **Google** only confirms who the player is; the game never sees passwords.
- The two values you send are public identifiers: the website uses them to
  talk to Supabase, and Supabase's row-level security rules (created by the
  SQL in Step 2) make sure each player can only write their own data.
