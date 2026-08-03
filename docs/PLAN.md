# PLAN

Build sequence. `PRD.md` says what; this says in what order and gated on what.

Every workstream item runs the loop (`CLAUDE.md` §2) and ends against the checklist (§6).

> **ID convention.** `D<n>` is always a **decision** (`docs/DECISIONS.md`). `M<n>` is always a
> **milestone** (`docs/MILESTONES.md`). Workstream items are lettered by workstream (`A1`, `B4`,
> `C6`…) — except the two that would collide, which carry a `W` prefix: **`WD<n>`** (jurisdiction
> config) and **`WM<n>`** (regulatory reporting). Workstream *letters* in the dependency columns
> below refer to workstreams, never to decisions.

---

## The shape of it

```
        ┌─ B1 jurisdiction ──────────────┐
        │  (client, blocking)            │
        │                                ▼
  PHASE 0 ──────────────────────────► PHASE 1 ──────────► PHASE 2 ──────► PHASE 3
  A money core                       E  KYC/AML          N  order book    2nd market
  B identity core                    F  RG suite         O  exposure      tote decision
  C scaffolding                      G  payments         P  commission    native apps
  D jurisdiction config              H  feed             Q  in-play
                                     I  sportsbook       R  trader API
  ▲ startable NOW                    J  casino
  │ none of A–D depends on B1        K  settlement       ▲ gated on B5
  └────────────────────────────────  L  back-office      │ market-making
                                     M  reporting        │ contract
                                                          
                                     ▲ gated on B1 + feed/aggregator contracts
```

**The critical insight for scheduling:** Phase 0 is entirely jurisdiction-independent. The ledger,
money primitives, odds ladder, identity state machine, audit store and job runner do not change
based on which regulator we end up under. **Do not idle waiting on B1** — see `docs/STATE.md`.

**The critical insight for the timeline:** licence applications run 4–12 months and several
jurisdictions require the platform to be materially complete and lab-certified *before* grant.
Engineering schedules against the licence timeline, not the reverse.

---

## PHASE 0 — Foundations

Startable immediately. Nothing here is blocked.

### Workstream A — Money core

The highest-priority work in the project. Everything else assumes it is correct.

| # | Item | Notes |
|---|---|---|
| A1 | Money type — integer minor units, arithmetic, explicit directional rounding | `CLAUDE.md` §3.1. No float, `bigint` at boundaries |
| A2 | Odds ladder — tick↔price, increments, validation | §5.4. Off-ladder prices must be unrepresentable |
| A3 | Ledger — TigerBeetle client, account model, transfer primitives | D5. Accounts: user cash · user bonus · user reserved · house commission · house liability · PSP suspense |
| A4 | Idempotency helper — the single implementation | §5.6. Every money path uses it |
| A5 | Reconciliation job — ledger ↔ relational, break reporting | Runs from day one, not added later |

**Exit gate.** Property tests pass: the ledger always balances; no sequence of valid operations
reaches a negative available balance; reserved never exceeds cash. Ledger reconciles under a
concurrent load fixture.

### Workstream B — Identity core

| # | Item | Notes |
|---|---|---|
| B1 | Account state machine | `PRD.md` §11.1. Property-tested; `SELF_EXCLUDED` has no exit before term |
| B2 | Auth + session — Ory Kratos or Keycloak | Standard OIDC |
| B3 | Authz — OpenFGA policy | §5.9. Segregation of duties expressed once |
| B4 | Eligibility gates — `assertCanWager` / `assertCanDeposit` / `assertCanWithdraw` | §5.8. Fail closed against stub providers |

**Exit gate.** Gates provably refuse on provider timeout and provider error, not just on a
negative response. Self-exclusion reversal is absent from the API surface (D14).

### Workstream C — Scaffolding

| # | Item | Notes |
|---|---|---|
| C1 | Repo structure + boundary lint | `CLAUDE.md` §7, §3.3. `dependency-cruiser` enforces layers |
| C2 | Config validation at boot — one file, zod-parsed | §3.11 |
| C3 | Job runner — Temporal, with dead-letter | D9 |
| C4 | Audit store — immudb + the back-office action wrapper | D8. Wrapper first, so no console can be built without it |
| C5 | Observability — OpenTelemetry, Prometheus, Grafana | — |
| C6 | CI assertions for the automatable rules in §6 | No float in money paths · bounded returns · no second §5 implementation |

**Exit gate.** A PR violating each automated rule fails CI. Verified by writing one deliberately.

### Workstream D — Jurisdiction config model

| # | Item | Notes |
|---|---|---|
| WD1 | Config schema — market types, stake/spin limits, RG defaults, KYC timing, bonus rules, reporting obligations | D13 |
| WD2 | `resolveJurisdiction()` + accessor | §5.7. No feature branches on a country code |
| WD3 | Encode the German ruleset as a fixture | Stress test, not a target market |

**Exit gate.** DE expressible with zero code changes — the **tiered** slot stake rule (`PRD.md`
§10.3: €1 baseline, €3 at 21+, €5 after a 90-day clean period, **gated on a per-operator GGL
approval flag**), 5-second minimum spin, no live casino under the sportsbook licence, in-play
restricted, cross-operator deposit cap.
**If it needs a code path, the config model is wrong and gets redesigned now, not after launch.**

> **Corrected 2026-08-04.** This gate previously read "€1 max slot stake" — a flat constant,
> superseded in July 2026. Proving the config model against a constant would have validated the
> wrong thing and then declared the model correct for every later jurisdiction. The real rule is a
> function of *(operator approval, age band, 90-day behavioural qualification)*, which is a far
> harder and far more useful test. Note the behavioural component also implies a precomputed
> player-tier projection — a real-time 90-day query cannot sit in the casino callback path.

---

## PHASE 1 — Sportsbook + Casino

Gated on **B1 (jurisdiction)** and the feed/aggregator contracts.

Sequence within the phase: **E → F** before **G**, and **H → I/J → K** in order. Back-office (L)
tracks alongside rather than following, because a console built after the fact never gets the
audit wrapper right.

| # | Workstream | Depends on | Notes |
|---|---|---|---|
| E | **KYC/AML** — vendor integration, verification tiers, source-of-funds, sanctions/PEP screening, SAR workflow | B, D | Buy IDV; do not assemble it (`PRD.md` §13.2). OpenSanctions needs a commercial licence |
| F | **RG suite** — limits, reality checks, time-out, self-exclusion, national register integration, behavioural risk model | B, D, E | Launch blocker, not a feature. Marketing suppression wires to RG state at platform level, never in the CRM |
| G | **Payments** — Hyperswitch, PSP onboarding, deposit/withdrawal, return-to-source, manual review threshold | A, E, F | D7. Multi-PSP from day one; never single-source |
| H | **Feed integration** — fixtures, prices, live data, results | C | Primary cost centre. Adapter behind an interface |
| I | **Sportsbook** — markets, two-phase placement, bet lifecycle, cash-out, risk limits, stake factoring | A, D, H | No fancy/session/toss markets (D3) |
| J | **Casino** — aggregator, seamless wallet, lobby, RTP display | A, D | Callbacks idempotent by transaction ID — duplicates are routine (D10) |
| K | **Settlement** — result ingestion, resolver, voids, dual-auth override | A, H, I, J | Append-only and replayable. Raw results stored |
| L | **Back-office** — trading, compliance, support consoles | C4, all | Every action through the audit wrapper |
| M | **Regulatory reporting** — per-market statutory feeds | D, K | Format per regulator; often documented only in the local language |

**Exit gate.** Regulator sign-off. Independent audit passed. Lab certification complete.

---

## PHASE 2 — Exchange

**Gated on B5 — a contractual market-making commitment.** Not an engineering gate. An empty order
book is worthless and users do not return after seeing one (D11).

| # | Workstream | Notes |
|---|---|---|
| N | Order book + matching — price-time priority, partial fills, order types | Matching is the solved part; `exchange-core` and LMAX Disruptor as design references (D6) |
| O | Exposure engine — net position per user per market, worst-case across runners | The part we write. Most-used screen for serious users; correctness *and* latency |
| P | Commission — per-market, per-tier, shown pre-bet by the same function that charges it | §5.3 |
| Q | In-play — bet delay, suspension on incident, keep-in-play orders | Suspension cancels nothing; blocks new matching only |
| R | Trader API — REST for state, WebSocket for prices, keyed and rate-limited | How liquidity providers are acquired. Not optional |

**Exit gate.** Closed beta meets `PRD.md` §9.3's **beta-exit** row — **<5% back/lay spread on the
single seeded market** at kick-off,
>70% matched-order rate, P99 match latency <150 ms.

---

## PHASE 3 — Scale

Second market (proves D13) · racing/tote licence decision · native apps · advanced trading tools.

---

## Estimation traps

Carried from `PRD.md` Appendix A.2 — the components that look small and are not:

- **Ledger + reconciliation** — looks like CRUD; is the highest-correctness component in the
  system. TigerBeetle removes most of the trap *if adopted in A3*; it cannot be retrofitted cheaply.
- **Exposure engine** — worst-case P&L across every runner, live, under partial fills.
- **Seamless wallet idempotency** — duplicate callbacks are normal traffic; naive implementations
  double-credit.
- **Cash-out** — presents as a button, is a pricing problem.
- **RG** — cross-cutting; touches registration, login, deposit, wager, marketing, back-office.
  Cannot be bolted on late, which is exactly when teams try.
- **Settlement edge cases** — voids, dead heats, non-runners, abandonments, partial settlement,
  resettlement. Long tail, all money-affecting.
- **In-play load** — 20× spikes at kick-off. Nothing like a normal web app.

## External dependencies — flag with owners at kickoff

Slippage on any of these will otherwise read as engineering delay: licence grant · odds feed
contract · casino aggregator contract · PSP underwriting · market-maker agreement · lab
certification scheduling.
