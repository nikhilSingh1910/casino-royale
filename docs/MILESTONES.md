# MILESTONES & TODO

> **Scope: play-money only (D32).** M5 (KYC/AML), M6 (statutory RG), M7 (payments), M12 (reporting)
> and the licensing gate are **out of scope** — retained as reference. The active track is the
> cricket `CM`-series in `docs/CRICKET-MVP.md`; the `M`-series below is the original real-money plan.

Derived from `docs/PLAN.md` (sequence) and `docs/ARCHITECTURE.md` (shape). Workstream references
in brackets map back to `PLAN.md`.

> **These `M`-series milestones are the general, multi-engine plan.** The **active track is
> cricket-only**, whose **`CM`-series** milestones live in `docs/CRICKET-MVP.md` and build on the
> shared `M0–M3` and `M5–M7` here. The casino (M9) and the exchange (M13–M15) are deferred (D24).

**Every milestone ends in a proof** — something demonstrable or a test that passes, never
"component X is done". Proofs are the client-visible checkpoints and the natural invoice
boundaries.

**Sizing is relative (S/M/L/XL), not absolute.** Absolute numbers need calibrating against team
size and stack familiarity — do that before quoting (`PRD.md` Appendix A.4). Anchor: M1 is the
largest single milestone in Phase 0 and roughly 3–4× M0.

Legend: 🟢 startable now · 🔴 blocked on **B1** (jurisdiction) · 🟠 blocked on a commercial contract

> **ID convention.** `M<n>` here is always a **milestone**. `D<n>` is always a **decision**
> (`docs/DECISIONS.md`). Workstream task codes are lettered by workstream (`A1.1`, `B4.5`, `C6.2`…)
> — except the two that would collide, which carry a `W` prefix: **`WD<n>`** (jurisdiction config)
> and **`WM<n>`** (regulatory reporting).

---

# PHASE 0 — Foundations

**All of Phase 0 is jurisdiction-independent.** Do not idle waiting on B1.

M1, M2 and M3 run largely in parallel once M0 lands.

---

## ✅ M0 — Scaffold stands up · **S** — DONE 2026-08-04

> **Proof:** a deliberately rule-violating PR fails CI for each automated rule. Boot fails loudly
> on a missing env key. **Verified:** `pnpm check` green (typecheck · lint · boundaries · 9 tests);
> the boundary lint rejected a real cross-feature violation; ConfigService throws on a missing
> `DATABASE_URL`.

- [x] **D6** confirmed (D27) — TypeScript. Stack chosen: **NestJS (Fastify) + Kysely + Postgres**.
- [x] `C1.1` Repo structure per `CLAUDE.md` §7 (updated to the NestJS trimmed tree)
- [x] `C1.2` `dependency-cruiser` — layer boundaries (`.dependency-cruiser.cjs`)
- [x] `C1.3` `ledger-barrel-only` rule — nothing outside `ledger/` reaches past its barrel
- [x] `C2.1` `src/shared/config` — zod-parsed at boot; `no-restricted-properties` bans `process.env` elsewhere
- [~] `C5.1` **Trimmed (D33):** pino structured logging + `/health`. Full OTel/Prometheus/Grafana deferred (over-build for the MVP)
- [x] `C6.1` custom ESLint rule `no-float-in-money` (money/ledger dirs)
- [~] `C6.2` `bounded-list-return` — heuristic, `warn` for now (per the M0 adversarial review; promote to `error` once proven non-flaky)
- [~] `C6.3` set up via dep-cruiser; the single-owner *symbol* check activates as those functions land (they don't exist yet)
- [x] `C6.4` guardrail meta-test (`test/guardrails.spec.ts`, RuleTester) + a demonstrated boundary-violation failure

---

## ✅ M1 — Chip ledger is provably correct · **L** — DONE 2026-08-04

> **Proof — verified.** Pure double-entry core property-tested with fast-check (300+ runs: always
> balances, never negative, matches an independent tally). Integration tests against **real
> Postgres**: top-up/reserve/win/lose/void with correct balances; over-reserve refused; idempotent
> by key; no double-settle; **5 concurrent reserves of 30 vs a 100 balance → exactly 3 succeed,
> balance never negative, invariants hold** (advisory-lock serialisation). `verifyIntegrity()`
> confirms ledger sums to zero and reserved == open reservations. 22 tests green under `pnpm check`.
>
> **Built:** `ledger/core.ts` (pure rules) · `ledger/ledger.service.ts` (Kysely, advisory lock,
> idempotent) · `db/` (schema + migrate) · `shared/odds` (scaled-int price, customer-favour rounding).
> **Deferred:** A2.1–A2.3 exchange ladder (exchange-only, Phase 2); `C3.1` pg-boss job queue (→ CM4,
> when settlement jobs land). **Hardening TODO:** store op-kind on `ledger_txn` and assert it on
> idempotent replay (guards against a key reused across *different* operations); materialise balances
> if `SUM`-per-op becomes a hotspot.

The highest-priority work in the project. Everything else assumes it.

**Money primitives [A1, A2]**
- [ ] `A1.1` Money type — integer minor units, validating constructor, no float ingress
- [ ] `A1.2` Arithmetic — add, subtract, multiply-by-rate with explicit rounding mode
- [ ] `A1.3` Rounding policy — house's favour on commission, customer's on payouts, per-operation
- [ ] `A1.4` Property test: no operation sequence creates or destroys value
- [ ] `A2.1` **Exchange** odds ladder — tick↔price table, 1.01–1000, variable increments
- [ ] `A2.2` Off-ladder **exchange** prices unrepresentable, not runtime-rejected
- [ ] `A2.3` Property test: tick → price → tick round-trips for every tick
- [ ] `A2.4` **Sportsbook** prices as scaled integers (fixed-point) — a *separate* type from the
      exchange tick index, per `CLAUDE.md` §3.1
- [ ] `A2.5` Lint/CI: the two price types are not interchangeable

> **Corrected 2026-08-04.** `A2.2` previously read "off-ladder prices unrepresentable" without
> qualification, which is wrong for the sportsbook: feed prices are arbitrary decimals and 2.37 is
> perfectly legitimate. Forcing them onto the exchange ladder would silently round every sportsbook
> price to the nearest tick. `CLAUDE.md` §3.1 now specifies two representations; `A2.4`/`A2.5` make
> that concrete.

**Chip ledger [A3]** — a double-entry table in Postgres (D33); no TigerBeetle.

- [ ] `A3.1` Ledger module in `ledger/` — the only writer of `ledger_entries`. Every movement is a
      balanced debit/credit pair, append-only
- [ ] `A3.2` Accounts (one chip currency, D30 collapsed): `user_chips` · `user_reserved` · `house`.
      No dispute-suspense (D31 void), no per-currency dimension
- [ ] `A3.3` Operations as in-transaction debit/credit pairs: reserve, release, capture, settle-win,
      settle-loss, top-up — each inside the placement/settlement transaction (D28)
- [ ] `A3.4` Balance derivation — available, reserved — from ledger entries. No stored authoritative balance

**Idempotency & atomicity [A4]** — the two-store seam (D17) collapses under D33.
- [ ] `A4.1` UNIQUE key on every chip-affecting request (bet, settlement, top-up) so a retry is a
      no-op — a constraint in the transaction, not a cross-store dance
- [ ] `A4.2` Placement and settlement each run as a **single ACID transaction** (bet/market state +
      ledger entries together) — atomic, no intent-then-execute, no sweeper
- [ ] `A4.3` Idempotency helper — the single implementation (§5.6)

**Jobs & integrity check [A5]** — no sweeper needed (single store).
- [ ] `C3.1` Light durable job queue (pg-boss / BullMQ) for settlement jobs — dead-letter on failure
- [ ] `A5.1` Integrity check: ledger sums to zero; `sum(reserved rows) == reserved balance` per user
- [ ] `A5.2` Concurrent placement/settlement test — no lost or duplicated chip movement

---

## 🟢 M2 — Accounts & sessions (play-money) · **M**

> **Proof:** a player signs up, logs in and holds a chip balance; an admin-suspended account cannot
> bet and its live session + streams are terminated; every back-office action is in the append-only
> Postgres audit log.

**Account & auth**
- [ ] `B1.1` Account state machine — `ACTIVE` · `SUSPENDED` · `CLOSED` (no KYC/self-exclusion states — D32)
- [ ] `B2.1` Auth + session — Ory Kratos or similar; no verification tiers
- [ ] `B3.1` Basic RBAC — player · admin · trader (fine-grained OpenFGA deferred, D33)

**The one gate**
- [ ] `B4.1` `assertCanBet()` — account `ACTIVE` **and** sufficient chips. No deposit/withdraw/KYC
      gates (D32)
- [ ] `B4.2` Test: a suspended or chip-short account is refused

**Suspend kills the session** — anti-abuse, the light form of D18 (no self-exclusion regime under D32)
- [ ] `B4.5` Suspending an account terminates its sessions and closes its live streams
- [ ] `B4.6` Test: admin-suspend mid-session kills the active WebSocket

**Audit [C4]** — append-only **Postgres** (D33), not immudb
- [ ] `C4.2` Back-office action wrapper — built **before** any console, so none can skip it
- [ ] `C4.3` Records named operator, timestamp, before/after state

---

## ~~M3 — Germany expressible as pure config~~ — **CUT under D32**

Jurisdiction legality is moot for play-money, so this milestone is dropped. Its one useful piece —
**operator game-config** (enable/disable market types, chip stake limits, bet delays) — lives in
**CM2** (`XC2.4`), reframed from "jurisdiction legality" to "operator settings". The original
real-money jurisdiction-config plan is preserved in git history.

### ✅ Foundation gate
**M0, M1, M2 proofs green** — scaffold, chip ledger and accounts are ready. The cricket engine
(CM1–CM6, `docs/CRICKET-MVP.md`) builds on them, and CM6 is a playable product.

---

# ══════════ ARCHIVE — real-money plan, OUT OF SCOPE under D32 ══════════

> Everything below (M4–M15: sportsbook, casino, exchange, real-money compliance) is the **original
> licensed real-money plan**, retained as reference and for any future pivot. **It is not part of
> the play-money cricket build** — the active worklist is M0–M2 + CM1–CM6 (see `docs/CRICKET-MVP.md`).

# PHASE 1 — Sportsbook + Casino

🔴 Gated on **B1**. 🟠 M4 and M9 additionally gated on contracts.

Sequence: M5 → M6 before M7. M4 → M8/M9 → M10. M11 tracks alongside rather than following — a
console built afterwards never gets the audit wrapper right.

---

## 🟠 M4 — Markets visible from a live feed · **L**
> **Proof:** real fixtures, prices and results flowing from the contracted feed into market views.
> Feed outage renders markets **unavailable** — no fabricated prices anywhere (§3.10).

- [ ] `H1` Feed adapter behind an interface (one per provider, Liskov-substitutable)
- [ ] `H2` Fixtures and market catalogue ingestion
- [ ] `H3` Price stream ingestion → internal event stream
- [ ] `H4` Live data (scores, incidents) → suspension triggers
- [ ] `H5` Result ingestion → `raw_results`, append-only
- [ ] `H6` Degraded-state handling: feed down = market unavailable, bets refused

## 🔴 M5 — Identity verified end to end · **L**
> **Proof:** a real document verified through the vendor; tier transition T0→T1→T2 with
> source-of-funds evidence captured; a sanctions hit blocks and routes to review.

- [ ] `E1` KYC vendor adapter (buy IDV — do not assemble, `PRD.md` §13.2)
- [ ] `E2` Verification tiers T0/T1/T2 wired to the account state machine
- [ ] `E3` Age verification hard-block before any real-money action
- [ ] `E4` Sanctions/PEP screening (OpenSanctions commercial licence or vendor — budget it)
- [ ] `E5` Source-of-funds capture and review queue
- [ ] `E6` Transaction monitoring rules → alert queue
- [ ] `E7` SAR drafting and filing workflow
- [ ] `E8` 5-year retention policy enforced

## 🔴 M6 — Responsible gambling operational · **XL**
> **Proof:** a self-excluded test user is blocked at login, deposit and wager; is dropped from
> marketing at the platform layer; has live sessions terminated (D18); and appears correctly in
> the national register check.

Launch blocker, not a feature. Cross-cutting — cannot be bolted on later.

- [ ] `F1` Limits — deposit (daily/weekly/monthly), loss, wager, session duration
- [ ] `F2` Decreases immediate; increases only after jurisdictional cooling-off
- [ ] `F3` Reality checks — configurable interval, requiring acknowledgement
- [ ] `F4` Time-out — 24h to 6 weeks, self-service, immediate
- [ ] `F5` Self-exclusion — 6 months to permanent, no override path in code (D14)
- [ ] `F6` National register integration — checked at login, deposit **and** wager
- [ ] `F7` Marketing suppression wired to RG state at platform level, never in the CRM
- [ ] `F8` Behavioural risk model — loss-chasing, stake escalation, session spikes, night play,
      failed-deposit retry loops
- [ ] `F9` Tiered intervention workflow; every alert, action and outcome logged for the regulator
- [ ] `F10` Affordability checks at defined thresholds

## 🔴 M7 — Money in and out · **L**
> **Proof:** deposit and withdrawal complete against a real PSP in sandbox; primary PSP forced
> down and traffic fails over automatically; withdrawal blocked pending KYC.

- [ ] `G1` Hyperswitch deployed and configured
- [ ] `G2` Two PSPs minimum from day one — never single-source
- [ ] `G3` Routing rules + automatic failover; test by killing the primary
- [ ] `G4` Deposit flow through the D17 seam
- [ ] `G5` Withdrawal flow; return-to-source where required
- [ ] `G6` Manual review threshold, configurable, SLA-tracked
- [ ] `G7` Three-way daily reconciliation: PSP ↔ ledger ↔ provider logs

## 🔴 M8 — A bet placed, settled, paid · **XL**
> **Proof:** end-to-end — market open → bet placed against reserved funds → result ingested →
> settlement → ledger movement → correct balance, for a **single straightforward market**.
>
> **Scope note.** Void, resettlement and the settlement edge cases belong to **M10**, not here — an
> earlier version of this proof required them, which made M8 un-passable until M10's work was done
> while M10 is scheduled after it. M8 proves placement and a clean settlement path; M10 proves
> settlement is correct under voids, corrections and replay.

- [ ] `I1` Market and selection model; jurisdictional market-type filtering — fancy/session/toss are config-gated capabilities, default off, client-enabled per market (D21, D24), not excluded
- [ ] `I2` Two-phase placement: price validation → accept/reject on movement within tolerance
- [ ] `I3` Bet lifecycle state machine (`PRD.md` §11.4)
- [ ] `I4` Reservation at submission through the ledger
- [ ] `I5` Cash-out — pricing, not a button
- [ ] `I6` Risk: per-market liability caps, per-user stake factoring, auto-suspend on breach
- [ ] `I7` Arbitrage and syndicate detection; sharp-user flagging
- [ ] `I8` Integrity monitoring feed (IBIA or equivalent)

## 🟠 M9 — Casino live with a seamless wallet · **L**
**Depends on M6 (RG limits apply to casino play) and M7 (a funded wallet).** An earlier version of
the critical-path diagram showed M9 branching only from the feed, which is wrong — casino play is
subject to deposit, loss and session limits, and under a German licence to the per-spin stake tier.
> **Proof:** a game round debits and credits correctly; a **duplicated** provider callback is a
> no-op returning the first result; a rollback restores state exactly.

- [ ] `J1` Aggregator integration — one, not per-studio (D10)
- [ ] `J2` Seamless wallet through the D17 seam; **no fast path bypassing the ledger**
- [ ] `J3` Idempotency by provider transaction ID
- [ ] `J4` Rollback as a first-class operation
- [ ] `J5` Lobby — category, search, provider filter, RTP display where mandated
- [ ] `J6` Game round history retrievable for dispute resolution
- [ ] `J7` Load test: duplicate and out-of-order callbacks under concurrency

## 🔴 M10 — Settlement is replayable · **L**
> **Proof:** a settled market is recomputed from stored raw results and produces identical ledger
> effects. A manual override requires two operators and writes an immutable record.

- [ ] `K1` Settlement as a Temporal job, restart-safe mid-market
- [ ] `K2` One resolver per product, not per market type (§5.10)
- [ ] `K3` Void handling: stake restored atomically
- [ ] `K4` Corrections as compensating entries — never updates
- [ ] `K5` Edge cases: dead heats, non-runners, abandonments, partial settlement
- [ ] `K6` Manual override: dual authorisation + immutable audit record
- [ ] `K7` Replay test against stored raw results

## 🔴 M11 — Back-office operational · **L**
> **Proof:** every console action appears in the immutable audit log with operator, timestamp and
> before/after state. An operator cannot both adjust and approve the same balance.

- [ ] `L1` Trading console — exposure by market/event/sport, suspend, void, resettle
- [ ] `L2` Compliance console — KYC queue, AML triage, SAR, RG intervention log
- [ ] `L3` Support console — account view, bet/game history, scoped adjustments with reason codes
- [ ] `L4` All actions through the C4 audit wrapper
- [ ] `L5` Segregation of duties enforced by policy, tested

## 🔴 M12 — Regulator-ready · **M**
> **Proof:** statutory reports generate and validate against the regulator's own schema. Compliance
> evidence produced **without engineering involvement** (G3 in `PRD.md` §9.1).

- [ ] `WM1` Statutory reporting feed for the target market
- [ ] `WM2` Scheduled generation + delivery
- [ ] `WM3` Self-service compliance evidence export
- [ ] `WM4` Data retention and DSAR handling

### ✅ Phase 1 launch gate
Regulator sign-off · independent audit passed · lab certification complete.

---

# PHASE 2 — Exchange

🔴 **Gated on B5 — a contractual market-making commitment.** Not an engineering gate. An empty
order book is worthless and users do not return after seeing one (D11).

## M13 — Order book matches · **XL**
> **Proof:** deterministic replay — the same command sequence rebuilds an identical book. A
> partial fill racing a cancel resolves the same way every time.

- [ ] `N1` Command log — durable append **before** apply
- [ ] `N2` In-memory book, price-time priority, per-runner
- [ ] `N3` Single writer per market; shard by market
- [ ] `N4` Partial fills; matched vs unmatched unambiguous in the API
- [ ] `N5` Order types: limit, keep-in-play, cancel-on-in-play, fill-or-kill
- [ ] `N6` Restart replay from command log
- [ ] `N7` Determinism test: no wall-clock, no random tiebreaks

## M14 — Exposure is correct and fast · **L**
> **Proof:** bet slip, account screen, pre-wager check and risk console **agree** on exposure for a
> user with positions across 20 markets. No O(n²) under a busy book.

- [ ] `O1` `calculateCustomerExposure()` — the one implementation (`CLAUDE.md` §5 rule 2).
      **Not** the same function as `calculateOperatorLiability()` (§5 rule 11), which the trading
      console and auto-suspend use — those are different quantities from opposite sides of the
      same positions
- [ ] `O2` Worst-case P&L across every runner
- [ ] `O3` Incremental maintenance + full recompute path
- [ ] `O4` Property test: exposure never exceeds reserved funds
- [ ] `O5` Performance test under a busy book

## M15 — Exchange closed beta · **L**
> **Proof:** `PRD.md` §9.3's **beta-exit** row met — **<5% back/lay spread on the single seeded
> market** at kick-off, >70%
> matched-order rate, P99 match latency <150 ms.

- [ ] `P1` Commission — per-market, per-tier; shown pre-bet by the same function that charges it
- [ ] `Q1` Bet delay at the API boundary, 1–8 s by sport
- [ ] `Q2` Suspension: blocks matching, cancels nothing
- [ ] `Q3` In-play order handling
- [ ] `R1` Trader API — REST for state, WebSocket for prices
- [ ] `R2` API keys, rate limiting
- [ ] `R3` Closed beta with the contracted market maker
- [ ] `R4` Measure against §9.3 targets

### ✅ Phase 2 gate
§9.3 metrics met in beta.

---

# PHASE 3 — Scale

- [ ] Second market — the real test of D13
- [ ] Racing/tote licence decision (`PRD.md` §11.6)
- [ ] Native apps
- [ ] Advanced trading tools
- [ ] Revisit D6 if measured load demands a JVM/Rust engine
- [ ] Revisit Kafka if event volume justifies it (`ARCHITECTURE.md` §10)

---

## Unscheduled — found by the 2026-08-04 review, not yet placed

Each of these is specified somewhere in `PRD.md` and appears in **no workstream and no milestone**.
Listed rather than silently scheduled, because placing them is a scoping decision.

**Launch-blocking licence conditions — these gate the Phase 1 exit, not the later compliance cycle:**

- [ ] **Player-funds segregation mechanics** (`PRD.md` §11.11) — designated client-money account,
      aggregate player liability calculable on demand and reconciled daily, published protection
      rating disclosed at registration. Written into §11.11 *specifically because* nothing
      specified it, and still unscheduled. Needs a ledger-level query, so it interacts with
      ARCHITECTURE §12 item 1.
- [ ] **Complaints procedure and ADR provider** (§11.11) — mandatory in the UK, equivalent
      elsewhere. Has a vendor lead time.
- [ ] **T&C versioning with re-acceptance** (§11.11) — immutable record of which version each user
      accepted and when, retrievable years later for dispute resolution.
- [ ] **Certification environment** (§11.11) — a Phase 1 exit-gate condition (lab certification)
      with no milestone and no lead time anywhere. GLI/eCOGRA scheduling is not instant.
- [ ] **Dormant accounts** (§11.11) — definition, fee prohibition, fund-return obligation.

**Non-functional requirements stated in `PRD.md` §12 with no owning task:**

- [ ] **Disaster recovery** — RPO <1 min / RTO <30 min is claimed for the ledger, unverified
      against TigerBeetle's actual replication model. **Coordinated** recovery of Postgres *and*
      TigerBeetle to a consistent point is the real requirement; a split recovery corrupts the
      money/state relationship, which is the worst failure this system has.
- [ ] **Backup and restore testing**
- [ ] **Penetration test** — pre-launch and annual
- [ ] **Data residency mechanism** — asserted per licence, no mechanism given the chosen stores
- [ ] **Ledger-imbalance alerting** and the P1 process implied by "settlement accuracy 100%"
- [ ] **Reconciliation break runbook** — reconciliation is scheduled (A5.2, G7); the response to a
      discovered break is not. Who is authorised to correct, and how, given an append-only ledger?
- [ ] **Load testing** against the §12 spike assumption — which is itself a placeholder needing
      calibration from the feed provider

**Commercially significant, scope decision required (`PRD.md` §11.12, §16 Q7):**

- [ ] **Bonusing** (§11.8) and **affiliates** (§11.9) — specified, decided (D2), scheduled nowhere.
      `CLAUDE.md` mandates modules for both. Launching with neither means no acquisition engine.

**Deferred by decision to the later compliance cycle** — GDPR/DSAR/erasure, SOC2, retention
schedules, consent. Not listed here. One carve-out survives because it is unretrofittable:
`C4.2`'s audit wrapper must write **opaque user IDs, never names or emails** — immudb is
cryptographically append-only, so records written wrong cannot be cleaned later without destroying
the audit chain.

---

## Critical path

```
D6 → M0 → M1 ──────────────────────────┐
          M2 ──────────┐               │
          M3 ──────────┤               │
                       ▼               ▼
   B1 ──────────► M5 → M6 → M7 → M8 → M10 → M12 → Phase 1 gate
   feed ────────► M4 ──┘         M9 ──┘
                                  M11 (alongside)

   B5 ──────────► M13 → M14 → M15
```

**Longest chain to launch:** M0 → M1 → M5 → M6 → M7 → M8 → M10 → M12.

**M2 and M3 have slack. M4 and M9 do not necessarily** — both are 🟠 contract-gated, and M8 depends
on M4 while M9 depends on M6 and M7. If the feed or aggregator contract lands late, either becomes
the constraint regardless of engineering capacity. An earlier version of this note claimed all four
had slack, which is only true if the contracts land early.

**M6 (RG) is the most commonly underestimated item on the path** — it looks like a settings screen
and is actually cross-cutting: registration, login, deposit, wager, marketing, back-office, plus
the D18 revocation channel.

> **§12 items 1, 2, 3(a) and 8 were signed off 2026-08-04 (D28–D31).** `A3.2`, `A3.3` and `A4.5`
> now reflect the decided approach — no longer blocked.
