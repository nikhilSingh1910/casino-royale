# MILESTONES & TODO

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

## 🟢 M0 — Scaffold stands up · **S**

> **Proof:** a deliberately rule-violating PR fails CI for each automated rule. Boot fails loudly
> on a missing env key.

**Blocked on:** D6 confirmation (runtime choice) — the only thing that must be settled first.

- [ ] Confirm or overrule **D6** (TypeScript platform, matching engine behind an interface)
- [ ] `C1.1` Repo structure per `CLAUDE.md` §7
- [ ] `C1.2` `dependency-cruiser` rules enforcing layer boundaries (§3.3)
- [ ] `C1.3` Rule: nothing outside `ledger/` imports the ledger client
- [ ] `C2.1` Single config file, zod-parsed at boot; lint-ban `process.env` elsewhere
- [ ] `C5.1` OpenTelemetry, Prometheus, Grafana baseline
- [ ] `C6.1` CI: no float in money paths
- [ ] `C6.2` CI: every list-returning function takes a bounded limit
- [ ] `C6.3` CI: no second implementation of a §5 single-owner rule
- [ ] `C6.4` Write one deliberately violating PR per rule; confirm each fails

---

## 🟢 M1 — Money is provably correct · **XL**

> **Proof:** property tests pass — the ledger always balances; **no *wager* path reaches a negative
> available balance**; `available + reserved` accounts for every unit deposited less that withdrawn,
> won and lost; and `sum(reserved over open orders) == reserved account balance` per user. Ledger
> reconciles clean after a concurrent load fixture with induced mid-operation failures.
>
> **Two corrections 2026-08-04.** (1) The invariant was "no operation sequence reaches a negative
> available balance" — false once chargebacks exist, since a chargeback on money already wagered
> and lost *requires* a negative position or a suspense account (§12 item 8). Scoped to wager paths.
> (2) "Reserved never exceeds cash" was ambiguous, since reserved funds move *out of* cash and the
> two are disjoint. Replaced with the reconciliation invariant that actually catches a wrong release
> amount, a lost release, or a double release.

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

**Ledger [A3]** — §12 items signed off 2026-08-04 (D28–D31); the decided approach is below.

- [ ] `A3.1` TigerBeetle client wrapper in `ledger/` — the only caller in the codebase
- [ ] `A3.2` Account model **per user per currency** (D30 — currency via the TigerBeetle `ledger`
      field, encoded in the account-ID scheme from the first account minted): user cash · user
      bonus · user reserved · house commission · house liability · house **dispute-suspense** (D31,
      chargebacks) · PSP suspense
- [ ] `A3.3` Transfer primitives (D28): **reserve = posted transfer `cash→reserved`** (one
      `reserved` account/user, `timeout=0`, attribution in Postgres, invariant
      `sum(open reservations)==reserved balance`), release, payout, commission, **`reverse`** (D31).
      **Not** two-phase pending transfers — those cannot survive partial fills (D19)
- [ ] `A3.4` Balance derivation — available, reserved, withdrawable. No stored authoritative balance

**The seam [A4, D17]**
- [ ] `A4.1` `money_operation` table — status, caller idempotency key, **precomputed** transfer ID.
      **Must carry a UNIQUE constraint on the caller idempotency key.** Without it, the same key
      arriving on two nodes mints two transfer IDs and debits twice — and the ledger still balances,
      so nothing detects it (review finding C6)
- [ ] `A4.5` Transfer-id strategy (D28): the id is **generated once per operation and stored** with
      the intent; a *transient* failure retries under a **fresh id**, never the poisoned one
      (`id_already_failed` is permanent, D19 quote 7). Idempotency is enforced by the UNIQUE caller
      key on `money_operation` (A4.1), so a duplicate key never mints a second id — one operation,
      one net effect
- [ ] `A4.2` Idempotency helper — the single implementation (§5.6)
- [ ] `A4.3` Intent → execute → confirm wrapper; every money path goes through it
- [ ] `A4.4` Test: crash injected between commit and execute leaves a recoverable state

**Sweeper & reconciliation [A5]** — ships now, not when breaks appear
- [ ] `C3.1` Temporal deployed; worker skeleton; dead-letter state
- [ ] `A5.1` Sweeper — `PENDING` beyond threshold → look up transfer by ID → resolve
- [ ] `A5.2` Reconciliation — ledger ↔ relational, with break report
- [ ] `A5.3` Concurrent load fixture with induced failures; reconciliation proof

---

## 🟢 M2 — Identity and gates fail closed · **L**

> **Proof:** gates provably refuse on provider **timeout** and provider **error**, not only on a
> negative response. Self-exclusion reversal is absent from the API surface — demonstrated by
> attempting to call it.

**Account [B1, B2, B3]**
- [ ] `B1.1` Account state machine — `ACTIVE` · `PENDING_VERIFICATION` · `LIMITED` ·
      `SELF_EXCLUDED` · `COOLING_OFF` · `SUSPENDED` · `CLOSED`
- [ ] `B1.2` Property test: no transition exits `SELF_EXCLUDED` before term
- [ ] `B2.1` Auth + session — Ory Kratos or Keycloak, OIDC
- [ ] `B3.1` OpenFGA policy model
- [ ] `B3.2` Segregation of duties expressed once: balance-adjuster ≠ approver

**Gates [B4]**
- [ ] `B4.1` `assertCanWager()` · `assertCanDeposit()` · `assertCanWithdraw()` — one each (§5.8)
- [ ] `B4.2` Fail-closed semantics: cache miss + provider unavailable = block
- [ ] `B4.3` Stub providers with injectable timeout/error for testing
- [ ] `B4.4` Test each gate against timeout, error, and negative response separately

**Revocation [D18]** — the adversarial-review catch; easy to miss because request-scoped tests pass
- [ ] `B4.5` Revocation event channel on compliance state change
- [ ] `B4.6` Terminate sessions on revocation
- [ ] `B4.7` Close live streams on revocation
- [ ] `B4.8` Cancel or freeze resting orders per reason code
- [ ] `B4.9` Test: self-exclusion mid-session kills an active WebSocket

**Audit [C4]**
- [ ] `C4.1` immudb deployed
- [ ] `C4.2` Back-office action wrapper — built **before** any console, so none can skip it
- [ ] `C4.3` Records named operator, timestamp, before/after state

---

## 🟢 M3 — Germany expressible as pure config · **M**

> **Proof:** the full German ruleset encoded with **zero code changes** — the **tiered** slot stake
> rule (€1 baseline · €3 at 21+ · €5 after a 90-day clean period, **gated on a per-operator GGL
> approval flag**), 5-second minimum spin, no live casino under the sportsbook licence, in-play
> restricted to next-goal/final-result, cross-operator deposit cap.

Germany is the stress test, not a target market (D13). If it needs a code path, the config model
is wrong and gets redesigned **now**.

> **Corrected 2026-08-04.** This proof previously specified a flat "€1 max slot stake", superseded
> in July 2026 (`PRD.md` §10.3). Testing the config model against a constant would have passed the
> gate while validating the wrong thing — then declared the model sound for every subsequent
> jurisdiction. The tiered rule needs **four** dimensions: operator approval flag, age band,
> rolling 90-day behavioural qualification, and the baseline. That is the test worth passing.
>
> **Two consequences beyond config.** The behavioural qualification cannot be evaluated per spin
> inside the casino callback path, so it implies a **precomputed player-tier projection**
> (recalculated out-of-band; decreases applied immediately via the D18 revocation channel,
> increases on the scheduled recalculation). And the cross-operator deposit cap requires a
> **real-time LUGAS query per deposit** — it is not expressible as config alone, and LUGAS is
> currently mis-filed under "Regulatory reporting" in `PRD.md` §13.1. Both are unresolved.

- [ ] `WD1.1` Config schema — permitted market types, stake/spin limits, RG defaults, KYC timing,
      bonus rules, reporting obligations
- [ ] `WD2.1` `resolveJurisdiction(user)` — from verified residence, not IP (§5.7)
- [ ] `WD2.2` Config accessor; lint-ban country-code branching in features
- [ ] `WD3.1` Encode DE ruleset as a fixture
- [ ] `WD3.2` Encode one plausible target-market ruleset as a second fixture
- [ ] `WD3.3` Verify: adding the second required no code change

### ✅ Phase 0 gate
M0–M3 proofs all green. **This is the point at which Phase 1 can be estimated honestly.**

---

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
