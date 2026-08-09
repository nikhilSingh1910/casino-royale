# STATE

**Read this first, every session.** Where we are, what's blocking, what's next.

Last updated: **2026-08-04**

---

## What we're building

**A free-to-play virtual cricket betting game.** Play-money only, forever — virtual chips with no
cash value, no deposits, no withdrawals (**D32**, the governing scope decision). The cricket
mechanics mirror the reference platforms (match-odds / bookmaker / fancy-session markets); the chips
just don't convert to money.

> **This reframed the project on 2026-08-04.** It was specified and built as a *licensed real-money*
> platform; the client then confirmed play-money only. Roughly half the prior scope — licensing,
> KYC/AML, real payments, chargebacks, statutory RG, regulatory reporting — is **out of scope under
> D32**. Those docs are kept as reference (and for any future real-money pivot), not deleted. The
> cricket engine itself is unchanged.

## Phase

**Cricket play-money MVP COMPLETE + adversarial audit remediated — M0·M1·M2 + CM1–CM6 all DONE, every
audit finding closed (138 tests green, real Postgres).**
The full playable path works end to end: all three market groups placed, settled from their
authoritative inputs, correct ledger balance.

## Next: Phase 2 — deepen the play-money cricket product (D49)

Client chose (2026-08-09): stay play-money, deepen cricket. Sequence **PC1 → PC2 → PC3 → PC4 → PC5**
(PC6 casino + Track B real-money **gated**). **PC1 ✅** (`/me/bets` + P&L, My Account UI) · **PC2 ✅** (daily bonus: `POST /me/bonus/claim`, mint idempotent per UTC day). **PC3 ✅** — a: four-eyes `settle_match` (real matches settle); b: role-gated `/admin` operator console (pending queue approve/reject, market suspend/void, declare-result, exposure, audit log). Using it needs a seeded `trader`/`admin` account (two, for four-eyes). **PC4 ✅** (SSE `GET /matches/stream` + LiveEvents bus; the ticker publishes on every change; client refetches on push; match-data polls reduced to a 15–20s fallback). **PC5** (engagement: leaderboard / promotions / referrals) is next. PC1 was a bounded
`betsForUser` read (P&L derived, never stored) + My Account / Bet History / Statement / change-password /
signup screens. Full plan in `docs/PLAN.md` (Phase 2) and D49. Each milestone runs the §2 loop.

## Scope: cricket-first, sport-additive (D48)

Cricket-only for now, but the **money spine is sport-agnostic** (ledger, reservation, placement/
settlement mechanics, identity, trading guards, jobs — verified: no cricket terms). A sport is a
self-contained `features/<sport>/` module + feed adapter; sport #2 slots in with **zero spine
changes**. The registry abstraction is deliberately **not** built for one sport (§3.6). Known
extraction seam (resolve at #2): `trading`→cricket imports, the HTTP error filter, cricket-named
schema tables. Codified as CLAUDE.md §4 "A sport is a module, not a fork".

## Adversarial audit remediation (2026-08-08, D47)

A two-pass, fact-grounded adversarial audit found the **ledger primitive sound** but the reservation and
settlement layers around it not. All findings are now **closed and tested** (suite 121 → 138):

- **G1 (D44)** — placement is one ACID transaction (`onReserved` hook + row-locked market recheck): kills
  the orphan-on-crash, the late-bet strand, and the liability-cap race.
- **G2** — settlement is atomic per bet (`onSettled`/`onResettled` hooks + replay guard): ledger and bet
  status can't diverge. **Integrity** — `verifyIntegrity` now catches an `open` bet on a `settled` market.
- **D45** — pg-boss durable job queue; settlement runs + four-eyes overrides are jobs (execute-then-mark).
- **D46** — the full-match ticker auto-settles runner + ball-by-ball markets.
- **C2** N-outcome exposure/liability · **C3** `LedgerError`→409 (no leaked 500) · **C4** frontend
  idempotency key is one-per-intent · **O1** `migrate()` runs at boot · **O2** the ticker never runs in
  prod · **O3** `/auth/demo` is rate-limited.
- **Refuted on scrutiny (not bugs):** cross-user idempotency disclosure (needs guessing a v4 UUID); a
  resettle double-debit (the recovery path prevents it). **Deferred, not dead:** `FEED_SOURCE` (reserved
  selector + prod tripwire, not wired to a factory); `bet_delay_seconds` (reserved column, no enforcement).
- **Display:** money is shown in **€** (`formatMoney`); the ball-by-ball grid's `100000` is a raw
  liquidity/volume figure (King-parity cosmetic), not a balance.

Next is the deferred/hardening backlog (below).

In place: `PRD.md`, `CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/PLAN.md`, `docs/MILESTONES.md`,
`docs/CRICKET-MVP.md` (**the active build**), `docs/REVIEW-FINDINGS.md`, and the decision log
(**D1–D33**, append-only).

**Nothing blocks the build.** The four M1-gating architectural decisions were signed off
(D28–D31, though D31/chargebacks is now void under D32) and D6 confirmed (D27). B1 (jurisdiction) no
longer gates us — with no real money, licensing is the client's concern, not a Tech gate.

## In scope (play-money)

- **Cricket engine** — feed, markets (match-odds / bookmaker / fancy-session), operator pricing,
  in-play suspension/repricing, ball-by-ball settlement. `docs/CRICKET-MVP.md`.
- **Chip-economy ledger** — double-entry table in **Postgres** (D33), so chips can't be duplicated
  or lost. Bar is *game integrity*, not financial audit.
- **Accounts** — login + chip balance + chip top-ups (free / daily bonus / etc.), no verification tiers.
- **Feed** — cricbuzz11 or any cheap source is fine (no money settles; D26's accountability bar is gone).

## Out of scope under D32 (kept as reference)

Gambling licence + jurisdiction gating · KYC/AML (M5) · statutory RG + self-exclusion registers (M6)
· real payments + Hyperswitch (M7, D7) · chargebacks + dispute-suspense (D31) · regulatory reporting
(M12) · player-funds segregation · gaming duty / financial model.

## Stack — trimmed for play-money (D33)

**Postgres + Redis + Centrifugo + a job queue + lightweight auth.** The chip ledger is a double-entry
table in Postgres, so a bet or settlement is a single ACID transaction — **the two-store money seam,
sweeper and reconciliation are gone** (the hardest part of the project). Dropped: TigerBeetle,
immudb, Temporal, Hyperswitch, OpenSanctions. Deferred: ClickHouse, Kafka. No matching engine
(cricket is operator-priced).

## Open — not blocking

- **Monetisation** (ads / subscription / engagement) and app-store "simulated gambling" rules — the
  client's business/legal call (Appendix A.5), not Tech's.

## Next actions

Follow the **finalized build order** in `docs/CRICKET-MVP.md` — M0 → M1 → M2 → CM1…CM6, nine
milestones, each proof-gated. Run the loop (`CLAUDE.md` §2) per milestone.

1. ✅ **M0 — scaffold**, ✅ **M1 — chip ledger**, ✅ **M2 — accounts & sessions** — DONE, all verified
   against real Postgres (`pnpm check` green, 28 tests). **The foundation is complete.**
2. ✅ **CM1 — cricket feed**, ✅ **CM2 — markets + pricing**, ✅ **CM3 — placement + operator risk** —
   DONE (54 tests green, real Postgres). CM3: two-phase placement, **full-stake chip reservation via
   the M1 ledger** (same idempotency key as the bet; `assertCanBet` from M2), `calculateCustomerExposure`
   / `calculateOperatorLiability`, whole-market lock/suspend, per-market liability cap → auto-suspend,
   idempotent + crash-heal (deterministic `reservationId`). *Deferred:* timed bet delay, per-user stake
   factoring, section-level locks, match-odds/bookmaker placement, reserve+bet atomicity saga
   (`docs/CRICKET-MVP.md` CM3).
3. ✅ **CM4 — in-play settlement** — DONE (76 tests green, real Postgres). Fancy/session settlement is a
   pure fold over the append-only ball store + the one ledger (D35): over-block completion settles,
   back/lay resolve against the struck line, **void** returns stakes, **resettlement** corrects a
   flipped result via one **compensating** ledger txn (reserved untouched, ledger still balances),
   all idempotent by key. *Deferred:* match-odds/bookmaker settlement, multi-innings, per-wicket/match
   triggers, dual-auth SoD enforcement (→CM5), durable job-queue trigger, clawback-beyond-balance
   suspense (`docs/CRICKET-MVP.md` CM4).
4. ✅ **CM5 — trading console + integrity** — DONE (92 tests green, real Postgres). One C4 `AuditService`
   (before/after; the two prior writers migrated, `IdentityRepo.audit` deleted); one `RolesGuard`
   (rule 9); **four-eyes** void/resettle via `operator_action` (self-approval throws, atomic claim);
   suspend/reopen single-auth; exposure by market/user/match reusing §5 rules 2/11; a pure
   concentration integrity flag. *Deferred:* stake-factoring (XC5.3), HTTP e2e, the claim↔execute
   saga gap, SoD-by-identity (`docs/CRICKET-MVP.md` CM5, D36).
5. ✅ **CM6 — end-to-end playable product** — DONE (100 tests green, real Postgres). Built the **runner
   path** CM3/CM4 deferred (D37): `placeRunnerBet` (two-phase on the runner price, shares the one
   money-path with fancy) and `settleMatchResult` (settles match-odds/bookmaker from an authoritative
   declared result, invalid result fails loud, generalised `voidMarket`). The end-to-end proof places
   across all three groups, settles session-from-balls + runners-from-result, includes a void and a
   session resettle, and checks ledger integrity after every step (`docs/CRICKET-MVP.md` CM6).

## Next — deferred/hardening backlog (the MVP is playable; these are the known gaps)

Nothing blocks a playable demo. Remaining, roughly by value (all recorded in `docs/CRICKET-MVP.md`
and the decision log):
- ✅ **Public cricket HTTP API** — DONE (D38, 109 tests green, real Postgres + Fastify e2e).
  `GET /matches`, `GET /matches/:id` (public market view), `POST /bets` + `POST /runner-bets` (session-auth;
  userId from the session, never the body); money as integer-minor-unit strings; one global
  `DomainExceptionFilter` maps zod → 400 and typed domain errors to their 4xx (closed the deferred
  "zod→400" gap app-wide).
- ✅ **Frontend — Kingexch365 parity** — DONE (**D40**, re-skinned from the top5050 look after the client
  changed the clone target). `web/` React 18 + Vite + TS; web check green — typecheck · lint · **11 vitest
  tests** · build. **Green King desktop exchange**: gold logo + inline header login, dark-green nav, the
  classic **three columns** — Sports sidebar · **Highlights** table with **1/X/2** blue-back/pink-lay pairs +
  `BM`·`F`·`S` badges · **Open Bets** slip. An **In-Play page** (`/inplay`) with In-Play/Today/Tomorrow tabs
  and a navy **Cricket** section (cricket-only — no fabricated other sports). In-play detail = score/over strip + Match Odds + Fancy
  (No/Rate/Yes/Rate). All four UI states; float-free money (§5 rule 5); balance in € per contract §8
  (King shows raw chips — flagged). The **verified engine was ported unchanged** (D40); only the front
  was rebuilt. Run: backend `pnpm start:dev`, then `cd web && pnpm dev`.
- ✅ **Login page + demo** (D42) — full-screen `/login` (Kestrel logo, username/password, Login + **Login with
  Demo ID**); the header opens it. `POST /auth/demo` mints a throwaway account funded €1,000 via the ledger.
- ✅ **Live feed** (D43) — a gated `LiveTicker` (`LIVE_TICK_MS>0`, off in tests/prod) drips a generated
  ball per tick to in-play matches, reprices session lines, auto-settles due windows, and self-seeds a
  demo T20. Frontend polls, so scores + over strip + recent-result tick on their own. **Run the live demo:**
  backend `LIVE_TICK_MS=6000 DATABASE_URL=... pnpm start:dev`, then `cd web && pnpm dev`.
- ✅ **Ball By Ball** (D41) — a `ball_by_ball` runner market (8 next-ball outcomes: 0/1/2/3/4/6 runs, Wicket,
  Extra) reusing runner placement + `settleOutcome`; the King grid page (`/bbb/:id`) + a Recent-Result strip
  from the ball store. *Deferred:* the auto per-ball lifecycle (needs the live feed).
- ✅ **Score endpoint** (D39) + **lobby 1/X/2 odds** (D40) — `GET /matches/:id/score` (per-innings + current
  over from `scorecard()`); `GET /matches` now carries each match's match-odds top-of-book (one grouped
  query, no N+1). *Deferred:* live push (polling), chase/target summary, inline lobby betting (needs ids
  in the list), non-cricket sports/casino (coming-soon states), prod `/api` routing.
- **Per-runner operator liability / exposure** — the §5-rule-11 formula is binary; multi-runner needs a
  per-runner worst case (D37). Runner auto-suspend is off until then.
- **Per-user stake factoring** (`XC3.7`/`XC5.3`) and **timed bet-delay** (`XC3.4`).
- **Durable settlement job-queue trigger** — `settleDueMarkets` is callable but not yet drained by a
  worker (no queue built, D33).
- **Saga gaps** — reserve+bet atomicity (CM3), operator-action claim↔execute (CM5).
- **Multi-innings session markets**, **runner-market resettlement**, **HTTP e2e** for the console.
- **GDPR / SOC2 / compliance** — a later cycle, as agreed (out of scope now, D32).

## Notes

- Several regulatory figures in `PRD.md` §10 were never verified (`REVIEW-FINDINGS.md` §8b) — now
  moot under D32, but left flagged rather than presented as fact.
- Part I of `PRD.md` (reference-platform analysis) was produced entirely from public sources; no
  credentials are in this repository. The top5050 HAR analysis (data model) came from a capture the
  client provided.
