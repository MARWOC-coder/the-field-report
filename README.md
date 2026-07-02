# The Field Report

Gamified daily KPI tracker for the MARWOC community — Marines doing real estate
acquisitions. Members log their daily numbers in under 30 seconds, individual and
fire-team leaderboards create accountability and competition, and HQ (admins) verify
the big claims.

**Live app:** https://marwoc-coder.github.io/the-field-report/
*(First deploy: run `scripts/deploy.ps1` once — see Deploying below.)*

> We serve together. We earn together. Make one less.

---

## How it works

### For Marines
- **Log** (center tab): tap +/− counters for daily activity (dials, conversations,
  doors, D4D, mail, follow-ups, leads, appointments, offers). Saves automatically.
  Contracts and closed deals go through **Ring the Bell** — they need a note with
  details and HQ approval before points count.
- **Mission Complete:** log 25+ points in a day to secure your streak. Streaks are
  weekend-forgiving — missing Sat/Sun never breaks one, logging Sat/Sun extends it.
- **Board:** individual and fire-team standings for Today / Week / Month / All Time.
  The week (Mon–Sun) is the main competitive cycle. Fire team score = average points
  per Marine, with an **All Hands +15% bonus** when every member hits 3+ mission days
  that week. Most Improved and Recent Wins keep everyone in the fight.
- **Ranks:** career points (all-time, approved) climb the enlisted ladder
  E-1 Pvt (0) → E-2 PFC (500) → E-3 LCpl (2,000) → E-4 Cpl (6,000) → E-5 Sgt (15,000)
  → E-6 SSgt (35,000) → E-7 GySgt (75,000) → E-8 MSgt (150,000) → E-9 SgtMaj (300,000).

### For admins (HQ tab)
- **Approvals:** activate/reject new access requests; verify claimed contracts and
  deals (the note carries address/terms). Rejected entries earn nothing.
- **KPIs:** add KPIs, edit labels, point values, and daily caps, or deactivate ones you
  no longer track. Point changes apply to new entries only — history keeps its points.
- **Teams:** create fire teams (4 Marines is the doctrine), then assign members in the
  Members tab. Only empty teams can be deleted.
- **Members:** set status (active/pending/inactive), promote admins, assign fire teams.
  The last active admin can never be demoted.
- **Settings:** the invite code. Sign-ups that supply it are activated instantly;
  everyone else waits in Approvals. Rotate it if it leaks; clear it to force manual
  approval for everyone.

### Onboarding a new Marine
Send them the live URL and the current invite code. They tap **Request Access**, pick a
callsign, and they're in. Without the code they wait in your approval queue.

---

## Architecture

- **Frontend:** React 18 + Vite SPA (`app/`), vanilla CSS design system carried over
  from MARWOC HQ (scarlet/gold/OD palette, Black Ops One / Oswald / IBM Plex Mono).
  Hosted on GitHub Pages (hash routing, relative base).
- **Backend:** Supabase project `the-field-report` (`qflxrnnpqzbuoypxgwhv`, us-east-1,
  free tier) on the MARWOC org.
  - **Auth:** email/password. Signup runs through the `signup` edge function
    (`supabase/functions/signup/`), which creates pre-confirmed users via the service
    role — no confirmation-email rate limits. The `handle_new_user` DB trigger assigns
    pending/active status and handles the invite code.
  - **Postgres + RLS:** every rule is enforced in the database
    (`supabase/migrations/`): members write only their own entries, daily caps clamp
    server-side, outcome entries force `pending` status, admins are checked via
    `is_admin()`. The client is untrusted by design.
  - **RPCs:** `get_leaderboard`, `get_team_leaderboard`, `get_recent_wins`,
    `get_my_stats` (streak math lives in SQL).

## Development

```bash
cd app
npm install
npm run dev        # local dev server
npm run build      # production build to app/dist
npm run preview    # serve the build on :4173
node scripts/ui-smoke.mjs <email> <password> <shotdir>   # Playwright smoke test
```

Supabase URL and anon key live in `app/src/lib/supabase.js` (public by design; RLS is
the security boundary). Database changes go in `supabase/migrations/` and are applied
via the Supabase MCP/dashboard/CLI.

## Deploying

One command handles everything — creating the GitHub repo on first run, pushing source,
building, publishing `app/dist` to the `gh-pages` branch, and enabling Pages:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1
```

Run it again any time to ship updates. GitHub Pages requires a public repo on free
GitHub plans (the code contains no secrets — the anon key is public by design).

## Operational notes

- **Password resets:** there's no self-serve reset in v1 (Supabase's built-in mailer is
  rate-limited). Reset passwords from the Supabase dashboard → Authentication → Users.
- **Custom domain:** add one in the repo's Pages settings when ready (e.g.
  `report.marwoc.com` CNAME → `marwoc-coder.github.io`).
- **Design doc:** `docs/superpowers/specs/2026-07-02-field-report-design.md` — includes
  the research-backed reasoning for point weights, rank thresholds, and anti-cheat
  tiers, plus the v2 mechanic reserve (duels, brackets, seasons, divisions, proof
  uploads, dialer integrations) held back on purpose to fight the week-4–6 novelty dip.
