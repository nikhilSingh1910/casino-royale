# CLAUDE.md — the working contract

**This file is binding.** Every coding session in this repo follows it. If a request conflicts
with something here, say so before writing code rather than silently deviating. This file grows
over time; nothing is removed without a decision recorded in `docs/DECISIONS.md`.

---

## 0. What we're building

A **licensed EU/EEA real-money wagering platform** — betting exchange, fixed-odds sportsbook, and
aggregated casino, behind one identity and one wallet.

**One core loop.** Verified identity → funded wallet → wager placed against reserved funds →
market settles from an authoritative result → ledger moves money → every screen and every report
reads the ledger, never a cached balance.

Three engines hang off that spine: the **exchange** (peer-to-peer, commission on net winnings, no
book risk), the **sportsbook** (operator-priced, operator carries risk), and the **casino**
(aggregated third-party content).

**Start every session by reading `docs/STATE.md`** — current phase, blocking items, next actions.

- Where we are, and what's blocking → `docs/STATE.md`
- Full product specification → `PRD.md` (authoritative on *what*)
- Decisions and their reasoning → `docs/DECISIONS.md` (authoritative on *why*)
- Build sequence → `docs/PLAN.md`

The Indian exchange platforms described in `PRD.md` Part I are **reference only**. Read them to
answer "what does this product category do". Never port their structure. `PRD.md` §7 is the
disposition table for every one of their features and it is a review gate, not commentary.

---

## 1. EVIDENCE — the rule that governs every other rule

**Every claim is grounded in a verified fact. No exceptions.**

Before asserting anything about this codebase, the data, a dependency, a regulator's requirement or
a provider's behaviour — read the file, run the query, check the docs. Then state what was checked.

- **"I verified X by doing Y"** — a fact. Cite the file and line, the query and its output, or the
  command and its result.
- **"X follows from Y"** — a deduction. Say so, and show the step.
- **"I believe X, unverified"** — an assumption. Label it, and say what would confirm it.
- **"X needs checking against Z before we rely on it"** — an open question. Never silently
  upgrade one of these into a fact.

**This rule is stricter here than in a normal codebase, for two reasons.**

**Money.** A plausible-sounding balance is worse than an error. If a number cannot be traced to a
ledger entry, it is not a number — it is a guess wearing a currency symbol.

**Regulation.** Never state a licensing requirement, a limit, a deadline or a market restriction
from memory. Regulatory detail changes, varies by jurisdiction, and is the one category where a
confident wrong answer gets designed around for months. Cite the regulator's own text or say it
needs checking. `PRD.md` §10 is a starting map, not a source of truth — it was compiled from
public reporting and is explicitly pending counsel review.

When corrected by evidence, update immediately and say what the evidence changed.

---

## 2. THE LOOP — how we work

Every non-trivial task runs this cycle. Do not skip steps, do not collapse them, do not announce
a step and then not do it.

```
1. PLAN
2. REVIEW THE PLAN
3. ADVERSARIALLY REVIEW THE PLAN
4. FINALISE THE PLAN
5. CODE
6. REVIEW THE CODE
7. ADVERSARIALLY REVIEW THE CODE
```

**1 — Plan.** What changes, which files, which layers, what the contract is. Name the existing
code being reused. If nothing is being reused, justify that explicitly. If it touches money,
name the ledger entries it produces.

**2 — Review the plan.** Read it back against the request. Does it do what was asked, no more and
no less? Are all four states designed (loading, empty, error, degraded)? Does it touch a
single-owner rule (§5) or an invariant (§4)?

**3 — Adversarially review the plan.** Argue against your own work through three lenses, every time:

- **Endgoal** — does this move toward a platform that passes a licensing audit, or just satisfy
  today's ticket? Would a regulator reading this diff have a question?
- **All moving parts** — what else touches this? The ledger, the exposure engine, settlement, the
  RG gates, the audit log, provider callbacks, the jurisdiction config, in-play suspension. What
  breaks that isn't in the diff?
- **Big picture** — does this add a pattern we'll regret at 50k concurrent users at kick-off, or
  in a second jurisdiction? Does it create a second way to do something we already do one way?

State the strongest objection to your own plan and either answer it or change the plan. If the
objection stands, the plan changes. "I considered it" is not an answer.

**4 — Finalise.** Restate the plan as amended. This is what gets built.

**5 — Code.** Follow §3 and §4. No scope creep beyond the finalised plan.

**6 — Review the code.** Read the diff as a reviewer who did not write it. Boundaries respected?
Anything duplicated? Any unbounded return? Any query in a loop? Any money path without an
idempotency key?

**7 — Adversarially review the code.** Try to break it. Concurrency, duplicate provider callbacks,
a market suspended mid-match, a partial fill racing a cancel, a settlement arriving twice, a
withdrawal during a self-exclusion, a user at zero balance, a user with 400 open positions.
Name the failure mode you're least confident about.

**Exempt from the loop:** typos, copy edits, single-line fixes, formatting. Everything else runs it.
**Never exempt, regardless of size:** anything touching the ledger, settlement, exposure, or a
compliance gate. A one-line change to a money path runs the full loop.

---

## 3. NON-NEGOTIABLE CODE RULES

### 3.1 Money is an integer, always

**Money is stored, passed and computed as integer minor units. Never a float. Never a `number`
holding rupees-and-paise or euros-and-cents.**

- Persisted and transported as integer minor units (cents), `bigint` at any boundary that could
  exceed 2^53.
- **No floating-point arithmetic anywhere in a money path.** Not for stake, not for liability,
  not for commission, not for "just the display".
- **Odds are never floats either — but the two products represent them differently, and
  conflating them misprices every sportsbook market.**
  - **Exchange** prices are discrete. The ladder runs 1.01–1000 with variable increments.
    Represent an exchange price as its **tick index**, convert only through the ladder module
    (§5.4). An off-ladder price then cannot be constructed at all, which is the point.
  - **Sportsbook** prices come from the feed and are **not** on the exchange ladder — a fixed-odds
    price of 2.37 is perfectly legitimate. Represent these as **scaled integers** (fixed-point).
    Not ladder ticks, not floats.
  - **Do not unify these behind one type.** Forcing feed prices onto the exchange ladder silently
    rounds every sportsbook price to the nearest tick.
- Rounding is explicit, directional, and decided once per operation — never an accident of
  `toFixed()`. Commission rounds in the house's favour; payouts round in the customer's. Both are
  decisions, both are recorded, neither is implicit.

This is first because it is the cheapest catastrophic bug to prevent and the most expensive to
find later — it surfaces as a reconciliation break weeks after the code shipped, in production,
with real customer money on the wrong side of it.

### 3.2 Reuse before you create

**Do not create a new function, endpoint, component or table for a slightly different case.**
Extend, parameterise or compose what exists.

Before writing anything new:

1. **Search first.** Grep the domain term and the verb (`grep -r "calculateLiability" src/`).
2. **If something close exists, extend it.** Add a parameter, widen a type, compose it.
3. **Only create new when extending would make the existing thing worse** — genuinely different
   responsibility, not a different caller.
4. **Say which you did and why**, in the plan, before coding.

The stakes here are specific: a second liability formula, a second commission calculation or a
second eligibility check does not fail loudly. It diverges quietly, and the first symptom is a
customer whose exposure says one thing on the bet slip and another in their account.

### 3.3 Layer boundaries — enforced by lint, not by memory

```
routes → api → service → repo → database
                  ↘ integrations/  (feed, aggregator, PSP, KYC, registers)
                  ↘ ledger/        (the only path to money)
```

- `app/**` — routes only. No database access, no business logic, no provider SDKs.
- `features/*/api.ts` — auth middleware → zod-parse → call **one** service function → return.
  The only layer that knows about HTTP.
- `features/*/service.ts` — all business logic. **No `process.env`, no request objects.**
  Must be callable from a test and from a job.
- `features/*/repo.ts` — the only place that touches the database or opens a transaction.
- `ledger/` — the only place that moves money. No feature writes a balance directly, ever.
- `integrations/*` — the only place that calls an external provider.

Cross-feature access goes through a feature's published `index.ts`, never into its internals.

### 3.4 No N+1 — queries or loops

- **Never `await` a query inside a `for`/`map` over rows.** Batch it, join it, or `Promise.all`
  a bounded set.
- **Never `.filter()` a collection inside a loop over another collection.** Index by key once
  (`new Map()`), then look up. Exposure calculation across runners × open orders is exactly the
  shape that becomes O(n²) without anyone noticing until a busy market.
- **Every list-returning function takes a bounded `limit`.** No exceptions.
- **Never return an array whose length isn't bounded by an argument you received.** Asserted in CI.
- Prefer one query returning shaped rows over N queries assembled in TypeScript.

### 3.5 SOLID, as it actually applies here

- **Single responsibility** — if you're threading a boolean flag through a function to change what
  it does, that's two functions. Split it.
- **Open/closed** — adding a new sport, market type, PSP or casino provider is **one registry
  entry plus one adapter, and zero changes anywhere else.** If it isn't, the abstraction is wrong.
  Adding a new *jurisdiction* is configuration, not code (§4).
- **Liskov** — every PSP adapter satisfies the same interface; the payments service cannot know
  which one it's talking to. Same for feed adapters and KYC vendors.
- **Interface segregation** — repo methods are named for what callers need (`findOpenOrders`,
  `insertSettlement`). No generic `query()` escape hatch.
- **Dependency inversion** — services depend on repo and adapter *interfaces*. A service never
  imports the driver, `fetch`, or a provider SDK.

### 3.6 DRY, with judgment

Two similar lines are a coincidence. Three are a pattern — extract. But **premature abstraction is
its own failure**: do not build a framework for a case that exists once.

The exception, where the rule is absolute: the single-owner rules in §5 have **exactly one
implementation, always, from the first line of code.**

### 3.7 Comments: one line, two at most

**One line is ideal. Two is the maximum. There is no third line.**

Comments say **why**, never what. If the code needs explaining, the code is wrong. If the reasoning
needs more than two lines, it is a decision — put it in `docs/DECISIONS.md` and leave a one-line
pointer:

```ts
// D12: lay liability reserves at submission, not match — see settlement race in D12.
```

Never restate the code, never narrate the obvious, never write a paragraph header above a function
whose name already says it.

### 3.8 Subtract as often as you add

Growth is not progress. Every task ends with the codebase as small as the change allows.

- **Before adding:** can this extend something that exists? (§3.2)
- **After adding:** what did this make redundant? Delete it in the same change.
- **Refactor at three.** The second similar thing is a coincidence; the third is a pattern that
  should already have been extracted.
- **Delete dead code on sight.** Unused exports, superseded helpers, commented-out blocks,
  abandoned branches. If it is needed again it is in git.

### 3.9 Errors are typed

A discriminated union with codes. Never `throw new Error("some string")` that a caller then
string-matches. A rejected bet, an insufficient balance, a suspended market, a failed KYC and a
self-exclusion block are **five different outcomes** with five different customer-facing
behaviours and five different audit consequences. They are not one `Error`.

### 3.10 Degradation goes in the response, never only in the log

```ts
type Result<T> =
  | { status: 'ok';          data: T }
  | { status: 'partial';     data: T; missing: MissingReason[] }
  | { status: 'unavailable'; reason: FailureCode };
```

If a fallback path runs, the caller must be *type-required* to handle it.

**Never invent data to fill a gap.** Not a price, not a balance, not a result, not a settlement.
Not for demos, not for empty states, not "temporarily". If the feed is down, the market shows as
unavailable and accepts no bets. A fabricated odd is a mispriced liability; a fabricated balance
is a solvency error. Design the degraded state instead.

### 3.11 Config is validated at boot

`process.env` is read in exactly one file, zod-parsed at startup, and lint-banned everywhere else.
A missing key fails on deploy, not three hours into a settlement run.

### 3.12 Test the pure core

The liability formula, the exposure calculation, the commission calculation, the odds ladder, the
matching algorithm, the settlement resolver, the bonus wagering tracker — all pure, all testable
without a database, and they carry effectively all of the money-correctness risk. **Write those
tests before the screens that display their output.**

Property-based tests where the invariant is expressible: matched volume on both sides is always
equal; the ledger always balances; exposure never exceeds reserved funds; no sequence of valid
operations produces a negative withdrawable balance.

---

## 4. ARCHITECTURE INVARIANTS

Violating one of these is a design error, not a style disagreement.

> **Reframed by D32 (play-money) and D33 (single Postgres store).** The invariants below now govern
> **virtual chips in one Postgres store**. The two-store seam is gone; the gambling-compliance
> invariants (fail-closed KYC/self-exclusion gates, self-exclusion-no-override) are **out of scope
> under D32**, retained only as real-money reference.

**The chip ledger is the only authority on chips.** Double-entry, append-only, balanced — a table in
Postgres (D33). No balance column anywhere else is authoritative; any balance shown or used in a
decision is derived from ledger entries. Corrections are new compensating entries; **nothing is ever
updated or deleted.**

**State and chips live in one store (D33).** Users, bets, markets and the chip ledger are all in
Postgres, so a bet placement or settlement is a **single ACID transaction** — a bet can never be
recorded-but-unfunded. This collapses the former two-store seam (intent-then-execute, sweeper,
cross-store reconciliation, D17), retained only in the real-money reference (`ARCHITECTURE.md` §2).

**Every chip-affecting operation is idempotent by key.** Bet placement, settlement, void, chip
top-up. A retried request is a no-op returning the first result, never a second chip movement.
Within one transaction this is a unique-key check, not a cross-store dance.

**No negative chip balance, ever.** A bet may only be placed against currently-available chips. No
path lets a balance go negative or issues chips as credit. (D31/chargebacks is void under D32, so
this reverts to the simple form — there is no real payment to reverse.) Enforced in the ledger, not the UI.

**Eligibility checks fail closed (reduced under D32).** The heavy gates — KYC, self-exclusion
registers, jurisdiction — are out of scope for play-money. Any check that does remain (account
status, an app age-gate) still blocks on error rather than allowing through.

**~~Self-exclusion has no override~~ — out of scope under D32.** Statutory RG does not apply to
play-money; retained in the real-money reference.

**Reservation precedes exposure.** Chips for a bet — stake for a back, `(odds − 1) × stake` for a
lay — are reserved at **placement** as part of the same transaction (D28). Operator-priced cricket
has no resting orders, so it is a single fixed reservation, captured or released at settlement.

**Settlement is append-only and replayable.** Ball events are stored raw as received. Any settlement
can be recomputed from them. Manual override writes an append-only audit record (D33 — Postgres, not
immudb) — a recorded event, never an edit.

**The feed proposes; the platform disposes.** No external input — odds feed, provider callback,
result service — mutates a balance or settles a market directly. It produces a validated event
that platform code acts on. External systems are untrusted by default, including the ones we pay.

**Jurisdiction is configuration, not a fork.** Market types, limits, RG defaults, bonus rules,
KYC timing and reporting obligations are all per-jurisdiction config resolved through one module
(§5.7). A second jurisdiction must not require a second code path. (`PRD.md` §10.3 — Germany is
the stress test for this: if the DE ruleset can't be expressed as config, the config model is
wrong.)

**A sport is a module, not a fork.** Cricket is sport #1 and the only sport in scope now, but a
second sport must slot in without a rewrite (§3.5). The money spine — ledger, reservation, placement
and settlement *mechanics*, identity, authorization, jobs, money/odds — is **sport-agnostic**: it knows
markets, runners, bets and reservations, never cricket, and stays that way. A sport is a self-contained
feature module (`features/<sport>/` plus its feed adapter under `integrations/`) supplying the feed,
event store, market creation, pricing and settlement *resolvers*. **Do not build the sport registry for
one sport** (§3.6 / §3.8 — extract at sport #2, not before). Three coupling points are the known
extraction seam, to be resolved when #2 arrives and **not deepened meanwhile:** `trading` importing
cricket's services directly (→ a sport-agnostic settlement/exposure port), the HTTP filter mapping
cricket's errors (→ a shared error registry), and the cricket-named tables `cricket_match` /
`raw_ball_event` / `fancy_market` (→ a generic `event` + per-sport store). See `docs/DECISIONS.md` D48.

**Slow work goes in a table, not a request.** Settlement runs, payout approvals, KYC escalations,
reconciliation, regulatory exports — job rows drained by a worker, with attempts, backoff and a
dead-letter state.

**Every back-office action is attributable and immutable.** Named operator, timestamp, before and
after state, written to the tamper-evident audit store. This is the first artefact an auditor
asks for, and it cannot be reconstructed after the fact.

---

## 5. THE SINGLE-OWNER RULES

Each of these has **exactly one implementation** in the repo. A second one is a bug, and there is
a test that fails if one appears.

1. **Money movement** — one ledger client. No feature, job or migration writes a balance directly.
2. **Customer exposure** — one `calculateCustomerExposure()`: a *user's* worst-case loss across a
   market's runners. Called by the bet slip, the account screen and the pre-wager funds check.
   Those three cannot be allowed to disagree.
3. **Commission** — one implementation, per-market and per-tier aware. Shown pre-bet and charged
   post-settlement by the *same* function.
4. **The odds ladder** — one module owns tick↔price conversion, increments, and validation.
   A price constructed anywhere else is a lint error.
5. **Money formatting** — one module constructs every `Intl.*` formatter. A bare
   `new Intl.NumberFormat(...)` or a `.toLocaleString()` elsewhere is a lint error.
6. **Idempotency** — one helper. Every money path uses it; no call site invents its own
   dedupe-by-checking-if-it-exists.
7. **Jurisdiction resolution** — one `resolveJurisdiction(user)` and one config accessor.
   No feature reads a country code and branches.
8. **Eligibility gates** — one `assertCanWager()`, one `assertCanDeposit()`, one
   `assertCanWithdraw()`. Every entry point calls them; none reimplements a subset of the checks.
9. **Authorization** — one `requireAuth`, one `requireRole`. Back-office segregation of duties is
   expressed once, as policy.
10. **Settlement resolution** — one resolver per product (exchange, sportsbook), not one per
    market type.
11. **Operator liability** — one `calculateOperatorLiability()`: the *book's* worst-case payout on
    a market. Called by the trading console and the auto-suspend risk check.

> **Why 2 and 11 are separate.** They are different quantities computed from opposite sides of the
> same positions. An earlier version of this file put both behind a single `calculateExposure()`
> used by the bet slip *and* the risk console — which would have required a flag to switch
> behaviour, the exact antipattern §3.5 bans. Keep them apart, and keep each single-owner.

---

## 6. BEFORE YOU SAY IT'S DONE

- [ ] The loop (§2) was actually run, including both adversarial passes
- [ ] No float touched a money or odds path (§3.1)
- [ ] Nothing new was created that could have extended something existing (§3.2)
- [ ] Layer boundaries respected; nothing outside `ledger/` moved money (§3.3)
- [ ] No query in a loop, no filter in a loop, every list bounded (§3.4)
- [ ] No new second implementation of a §5 rule
- [ ] Every money path is idempotent by key (§4)
- [ ] Compliance gates fail closed on error and timeout (§4)
- [ ] Errors typed; degradation representable in the return type
- [ ] All four UI states designed: loading, empty, error, degraded
- [ ] Pure logic has tests; invariants have property tests (§3.12)
- [ ] Back-office actions write an audit record
- [ ] Ledger reconciles after the change under the concurrent test fixture

---

## 7. WHERE THINGS LIVE

**Stack (M0):** NestJS (Fastify adapter) · Kysely + Postgres · zod (config) · pino · Jest · ESLint +
dependency-cruiser. Play-money cricket, trimmed per D33.

```
src/
  main.ts                   bootstrap (Nest + Fastify + pino + shutdown hooks)
  app.module.ts             composition root — imports the feature modules
  health/                   /health controller + module
  features/<domain>/        <domain>.module · .controller · .service · .repo · schema · index.ts
    identity/               accounts & sessions (M2)
    cricket/                markets · betting · settlement (CM1–CM4)
    trading/                operator console + risk (CM5)
  ledger/                   the ONLY authority on chips — double-entry, Postgres (M1). Barrel-only.
  integrations/
    feed/                   cricket ball-by-ball adapter (interface + fixtures/cricbuzz)
  shared/
    money/                  Chips = integer (bigint), arithmetic, formatting. No floats.
    odds/                   scaled-integer prices (operator-priced; no exchange ladder)
    config/                 the ONLY reader of process.env — zod-parsed at boot
  jobs/                     settlement job queue (pg-boss)
  db/                       Kysely connection + migrations (M1)
tools/ · eslint-local-rules.js   custom money guardrails (no-float-in-money, bounded-list-return)
test/                       cross-cutting specs (guardrail meta-test C6.4); unit specs sit beside code
.dependency-cruiser.cjs     layer + boundary rules (C1.2/C1.3/C6.3)
docs/                       STATE · PLAN · DECISIONS · ARCHITECTURE · MILESTONES · CRICKET-MVP
PRD.md                      the (real-money) product spec — reference; D32/D33 govern current scope
```

Cross-feature access goes through a feature's `index.ts`; nothing outside `ledger/` reaches past its
barrel. Both enforced by `pnpm lint:boundaries`.

---

## 8. HOUSE STYLE

- Match surrounding code: naming, comment density, idiom.
- Comments explain **why**, never what. A comment restating the code is deleted.
- No dead code, no commented-out blocks, no `TODO` without an issue reference.
- No placeholder or lorem content, and **no mock odds, balances or results** — not even in
  development fixtures that could be reached from a running app. If data isn't available, design
  the empty state.
- Domain terms are used precisely and consistently: *back*, *lay*, *stake*, *liability*,
  *exposure*, *matched*, *unmatched*, *settled*, *voided*. These have exact meanings; a loose
  synonym in a variable name becomes a loose assumption in a formula.
- Play-money balances are displayed as **credits** — a grouped whole integer, no fiat symbol, no
  decimals (D52); 1 credit = 1 stored chip. Presenting play chips as fiat (`€`) is a real-money-
  compliance risk under D32, so the fiat rule of `PRD.md` §4 is real-money reference only, revived
  only if Track B ships. (Storage is unchanged — chips are still integer units, no float, §3.1.)
