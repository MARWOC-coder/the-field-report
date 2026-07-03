# The Field Report — Design Spec (v1)

**Date:** 2026-07-02
**Project:** Gamified KPI tracker for the MARWOC community (Marine-only real estate acquisitions)
**Status:** FINAL — reconciled with local-build survey + deep web research

---

## 1. Purpose

MARWOC members (Marines doing real estate acquisitions) need a dead-simple place to log daily
acquisition KPIs and see where they stand — as individuals and as fire teams. The point is
accountability and competition: if your name isn't on the board, everyone knows you didn't do
the work. Admins control the KPI catalog, approve high-value claims (contracts/deals), approve
new members, and manage fire teams.

**Success criteria**
- A member can log their day's numbers in under 30 seconds from a phone.
- Leaderboards (individual + fire team) update immediately and are impossible to quietly hide from.
- Outcome claims (contracts, closed deals) require admin approval before points count.
- New sign-ups can't see or do anything until an admin approves them (Marine-only gate).
- Admins can add/re-weight KPIs without code changes.

## 2. Architecture

**Chosen approach: Pure SPA + Supabase + GitHub Pages.**

- **Frontend:** React 18 + Vite SPA. Mobile-first (members log from phones) with a full
  desktop hub at ≥1024px: sidebar navigation, two-column page grids, and info rails
  (top-5 mini leaderboard, unit pulse totals, wins feed) so the desktop view works as the
  daily check-in dashboard. "Night Ops" design system (brass/scarlet dark, Rajdhani/Barlow).
- **Backend:** Supabase (new dedicated project on the existing MARWOC org, $0/mo free tier):
  - **Auth:** email/password via Supabase Auth. New users start `pending`.
  - **Postgres + RLS:** all authorization enforced at the database. Members read approved data,
    write only their own entries; admins get elevated policies via a `role` column checked in RLS.
  - **RPCs/views:** leaderboard aggregation, streak computation done in SQL (single round trip).
- **Hosting:** GitHub Pages (repo `MARWOC-coder/the-field-report`, gh-pages branch, hash routing).
  Live URL immediately; custom domain can be added later. No server to babysit.

**Alternatives considered**
1. Express + React + Postgres on Railway (command-center pattern) — matches ecosystem
   conventions, but Railway CLI is not authenticated on this machine, costs monthly, and adds a
   server to operate. Rejected for v1; the SPA can be re-pointed at a server later if needed.
2. Build inside GHL/Skool — no new login for members, but neither platform supports custom
   daily-entry forms + computed multi-period leaderboards without severe hacks. Rejected.

## 3. Data model

Schema `public`, all tables RLS-enabled.

- **profiles** — `id (uuid, = auth.users.id)`, `full_name`, `callsign`, `role ('member'|'admin')`,
  `status ('pending'|'active'|'inactive')`, `fire_team_id (nullable fk)`, `created_at`.
  Auto-created on signup via trigger with `status='pending'`.
- **fire_teams** — `id`, `name`, `motto`, `created_at`.
- **kpi_definitions** — `id`, `key`, `label`, `unit_label`, `points_per_unit`,
  `category ('activity'|'outcome')`, `requires_approval bool`, `daily_cap (nullable)`,
  `is_active`, `sort_order`. Admin-editable catalog; seeded with the researched KPI set.
- **kpi_entries** — `id`, `user_id`, `kpi_id`, `entry_date`, `quantity`,
  `status ('approved'|'pending'|'rejected')`, `note`, `reviewed_by`, `reviewed_at`, `created_at`.
  Unique `(user_id, kpi_id, entry_date)` — logging again the same day updates the row (upsert).
  Activity KPIs insert as `approved`; `requires_approval` KPIs insert as `pending`.
- **settings** — key/value jsonb. Includes `bootstrap_admin_email` (the signup trigger
  auto-promotes this email to active admin — solves first-admin bootstrap with zero SQL for
  the user) and `invite_code` (signups supplying the correct code in metadata activate
  immediately; wrong/missing code → `pending` for manual admin approval; admins can rotate
  or disable the code).
- **awards** — deferred to v2 (see §4.5).

Points are always computed as `quantity × points_per_unit` at read time via the current
definition — HOWEVER, to keep history stable when admins re-weight, `kpi_entries` snapshots
`points_each` at insert. Leaderboards sum `quantity × points_each` for approved entries only.

## 4. Gamification system

### 4.1 KPI catalog (seed — admin-editable)

Point weights derived from wholesaling funnel benchmarks (≈15,000 dials → 1,000 contacts →
100 qualified leads → 1 deal; ~7 offers per contract; 80% of contracts should close). The top
of the funnel is deliberately compressed (a contract is 250, not the 1,000+ pure funnel math
implies) so the daily grinder can beat the lucky closer on a weekly board — recognition, not
raw points, carries the celebration of a close.

| key          | label                  | pts/unit | category | approval | daily cap |
|--------------|------------------------|----------|----------|----------|-----------|
| dials        | Cold Call Dials        | 1        | activity | no       | 300       |
| conversations| Quality Conversations  | 10       | activity | no       | 50        |
| doors        | Doors Knocked          | 3        | activity | no       | 100       |
| d4d          | D4D Properties Added   | 1        | activity | no       | 100       |
| mail         | Direct Mail Sent       | 0.1      | activity | no       | 500       |
| followups    | Follow-Ups Completed   | 5        | activity | no       | 50        |
| leads        | Qualified Leads Logged | 25       | activity | no       | 10        |
| appts_set    | Appointments Set       | 40       | activity | no       | 10        |
| appts_held   | Appointments Held      | 25       | activity | no       | 10        |
| offers       | Offers Made            | 50       | activity | no       | 10        |
| contracts    | Contracts Signed       | 250      | outcome  | **yes**  | 5         |
| deals        | Deals Closed           | 500      | outcome  | **yes**  | 5         |

*2026-07-02 update:* `doors`, `d4d`, and `mail` deactivated — the community is
virtual-first (re-enable anytime from HQ → KPIs).

Outcome entries require a note (address/short details) — friction is the verification.
Daily caps are enforced server-side (trigger) — the standard defense against inflated
self-reports. Direct mail is weighted low on purpose: mail is money, not labor (anti pay-to-win).

### 4.2 Ranks

USMC enlisted ladder driven by **career points** (all-time approved, never reset) — separate
from the weekly competitive boards. Thresholds calibrated so ~1 solid week ≈ E-2 and E-9 is
community-elite territory:

E-1 Pvt 0 · E-2 PFC 500 · E-3 LCpl 2,000 · E-4 Cpl 6,000 · E-5 Sgt 15,000 · E-6 SSgt 35,000 ·
E-7 GySgt 75,000 · E-8 MSgt 150,000 · E-9 SgtMaj 300,000

Chevron-inspired insignia (not exact reproductions), shown next to names everywhere.
**No valor decorations ever** (stolen-valor-adjacent; offensive to this audience). Unit-award
theming (e.g., a future "Meritorious Unit Citation") is the safe lane for awards.

### 4.3 Leaderboards

- **Individual:** period tabs Today / **This Week (default)** / This Month / All Time.
  Weekly is the competitive cycle (ISO week, Monday start) — hard weekly reset keeps the
  bottom of the board in the fight.
- **Most Improved:** this week vs last week, points delta — the standard fix for
  "one dominant winner kills the competition."
- **Fire Teams:** weekly score = **average points per member** (handles uneven rosters) with an
  **"All Hands" 1.15× multiplier** when every member has ≥3 Mission Complete days that week —
  the accountability engine: your zero hurts the team.
- **Recent Wins feed** on the leaderboard page: approved contracts/deals ("SSgt Nasty locked up
  a contract — 250 pts"). Instant public recognition.

### 4.4 Streaks ("Mission Complete")

- A day counts as **Mission Complete at ≥25 points logged** (approved or pending) — a low bar
  by design; the streak protects the habit, points reward the volume.
- **Weekend-forgiving:** missing Sat/Sun never breaks the streak; logging Sat/Sun extends it.
- Current streak + best streak shown on the log page and profile. Milestones celebrated at
  7/30/100 days.
- Deferred to v2: streak freezes ("Liberty Passes"), 48-hour earn-back, battle-buddy streaks.

### 4.5 Deliberately deferred (the anti-novelty-cliff ammo)

Research shows engagement dips at weeks 4–6; hold new mechanics in reserve and drip them in:
head-to-head duels, bracket playoffs, divisions/leagues with promotion/demotion, quarterly
"Deployment" seasons with team re-drafts, badge racks, meritorious promotion boards,
proof-upload on outcomes, dialer integrations for auto-verified call counts.

## 5. Pages & flows

- **/login** — sign in / request access (signup). Pending users see a "standby for approval" screen.
- **/log (default)** — today's field report: stepper inputs for each active KPI, note field,
  one save button. Shows current streak + today's points.
- **/leaderboard** — individual & fire team boards, period tabs, rank insignia, movement arrows.
- **/me** — my stats: rank + progress to next rank, streak, weekly trend chart, entry history.
- **/team** — my fire team: roster, team totals, member contributions this week.
- **/admin** (admins only) — tabs:
  - **Approvals:** pending members (activate/reject) + pending outcome entries (approve/reject).
  - **KPIs:** edit catalog (label, points, caps, approval requirement, active).
  - **Fire teams:** create/rename teams, assign members.
  - **Members:** roles, deactivate.

## 6. Error handling & edge cases

- Unapproved user hits any page → routed to standby screen (RLS also blocks data).
- Duplicate same-day log → upsert (edit, not error). Editing past days allowed within 7 days
  (configurable); older locked.
- Admin rejects an outcome entry → points removed from boards automatically (status filter).
- Re-weighting a KPI affects future entries only (points snapshot).
- Last admin cannot demote/deactivate themselves (guard in RPC).

## 7. Testing & verification

- SQL: RLS policies verified via Supabase advisors + manual role-based queries.
- E2E manual verification: signup → pending → admin approve → log KPIs → leaderboard updates →
  outcome entry pending → admin approve → points land; run with two test accounts before handoff.
- `npm run build` clean; deployed site smoke-tested live.

## 8. Deployment & handoff

- GitHub repo `MARWOC-coder/the-field-report`, Pages from `gh-pages` branch.
- Supabase project `the-field-report` on MARWOC org (free tier).
- README: admin guide (how to approve, edit KPIs, manage teams), deploy commands, and how to
  bootstrap the first admin.

## 9. Research notes

**Local builds adopted from** (surveyed 2026-07-02):
- `MARWOC CP` — Marine design system carried over wholesale (scarlet #A6192E / gold #EAAA00 /
  OD green / khaki / ink palette, Black Ops One + Oswald + IBM Plex Mono fonts — woff2 files
  copied into `app/public/fonts`), MARWOC logo, rank-ladder + streak logic pattern
  (`server/progression.js`), vocabulary (Muster, callsign, Deal Bell, "Make One Less",
  "We Serve Together. We Earn Together.").
- `sales-brain` — the interaction blueprint: one-row-per-member-per-day upsert
  (`daily_activity` UNIQUE(rep_id, activity_date)), tap +/- counter logging UI
  (`ActivityTally.jsx`), leaderboard UI with period toggles / rank badges / "(you)" highlight
  (`Leaderboard.jsx`), tabbed admin panel, mobile-first bottom nav with center Log FAB,
  React Query with optimistic updates + invalidation.
- `six cockpit` — approval-queue UI pattern (Approve/Deny + note), route-gating pattern.
- Rejected: PIN-based auth (fine for a 5-rep internal team, too weak for a public community
  app), JSON-file persistence (CP), external-backend coupling (command-center).

**Web research** (18+ sources; key: Brent Daniels/TTP funnel math, REsimpli KPI benchmarks,
Sisu point precedents, SalesScreen/Spinify/Ambition mechanics studies, Duolingo streak/league
teardowns, USMC structure references, Wellable anti-cheat strategies) shaped: point weights
(§4.1), compressed outcome scoring, weekly-reset + most-improved boards, avg-per-member team
scoring + All Hands bonus, Mission Complete streak threshold, tiered verification
(caps → notes → admin approval), authentic-theming guardrails (no valor medals), and the
v2 mechanic reserve (§4.5).
