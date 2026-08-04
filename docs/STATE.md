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

**Foundations DONE (M0·M1·M2). Cricket: CM1·CM2·CM3·CM4·CM5 DONE; CM6 (end-to-end playable product) next.**

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
5. **CM6 (end-to-end playable product) is next** — the integration proof over CM1–CM5: a player with
   chips → a cricket match → bets on match-odds, bookmaker **and** a session market → ball-by-ball
   settlement → correct ledger balance, **including a void and a resettlement**. The full play-money
   path, end to end (`docs/CRICKET-MVP.md` CM6). NB: match-odds/bookmaker **placement** is not yet
   built (CM3 was fancy-only) — CM6 will surface that gap and decide scope.

## Notes

- Several regulatory figures in `PRD.md` §10 were never verified (`REVIEW-FINDINGS.md` §8b) — now
  moot under D32, but left flagged rather than presented as fact.
- Part I of `PRD.md` (reference-platform analysis) was produced entirely from public sources; no
  credentials are in this repository. The top5050 HAR analysis (data model) came from a capture the
  client provided.
