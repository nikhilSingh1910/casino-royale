# DECISIONS

Authoritative on **why**. `PRD.md` is authoritative on *what*; `CLAUDE.md` on *how*.

Nothing in `CLAUDE.md` is removed without a decision recorded here. Decisions are append-only —
superseding one means adding a new entry that says so, never editing the old one.

Format: **context → decision → consequence**. Reference them in code as `// D<n>: <one line>`.

---

### D1 — Reject the credit-agent hierarchy entirely

**Context.** The reference platforms (`PRD.md` Part I) run a multi-tier agent model: agents issue
IDs, extend credit as "chips", and settle in cash off-platform on a weekly cycle. It is the
product the white-label vendors actually sell.

**Decision.** Not ported, in any form. Direct-to-consumer registration only; the operator holds
all player funds in segregated accounts.

**Consequence.** Unlicensable on five independent grounds — credit betting is banned, agents
become unlicensed money transmitters, cash settlement without CDD is an AML failure by
construction, transferable IDs defeat self-exclusion, and there are no on-platform player funds
to segregate. This is not a feature to adapt; it is the business model, and the licensed model is
a different one. Acquisition moves to affiliates on revenue share (D2).

---

### D2 — Affiliates replace agents, and never touch player funds

**Context.** Acquisition in the reference model runs through the agent chain. Something has to
replace it.

**Decision.** Affiliate programme on NGR revenue-share, CPA, or hybrid. Affiliates never hold
player funds and never create accounts.

**Consequence.** The operator is liable for affiliate marketing, so affiliate content needs
pre-approval, ongoing monitoring and a fast termination path. Build the audit trail from the start.

---

### D3 — No fancy, session or toss markets

**Context.** Ball-by-ball and session markets (lambi, khado, over-runs, method-of-dismissal) are
the reference platforms' signature depth and a large share of their volume.

**Decision.** Excluded. Market types are restricted to those permitted in the target jurisdiction.

**Consequence.** These settle on micro-events controllable by a single player — the exact attack
surface in every major cricket spot-fixing case. Restricted or prohibited by European regulators
and flagged by integrity bodies. No compliance tooling makes them licensable, so there is no
version of this that ships later. Cricket volume expectations must be reset accordingly.

---

### D4 — Money is integer minor units; odds are tick indices

**Context.** Both are classic and expensive correctness failures in real-money systems.

**Decision.** All money is integer minor units, `bigint` at boundaries. No float in any money
path. Odds are represented as tick indices on the exchange ladder, converted only through the
ladder module.

**Consequence.** `CLAUDE.md` §3.1 and §5.4. Float money bugs surface as reconciliation breaks
weeks later, in production, with customer funds on the wrong side. Float odds make an off-ladder
price representable, which it must not be. Rounding becomes explicit and directional — house's
favour on commission, customer's on payouts — decided once per operation rather than inherited
from `toFixed()`.

---

### D5 — TigerBeetle for the ledger; Postgres for state; money moves ledger-first

**Context.** `PRD.md` §11.2 requires a double-entry ledger as the sole source of truth, and
§13.2 identified TigerBeetle as a strong fit (Apache 2.0, double-entry native, ACID, strict
serializability, 1M+ transfers/sec).

**Decision.** TigerBeetle holds funds. Postgres holds users, bets, markets and orders. Money moves
**ledger-first**; the relational row records the reference, tied by idempotency key. Continuous
reconciliation proves the two agree.

**Consequence.** The correctness and audit properties come from the database rather than from
application discipline maintained forever. The risk moves to the seam between the two stores —
dual-write is the failure mode, so the idempotency key and the reconciliation job are load-bearing,
not housekeeping. Cannot be retrofitted cheaply; adopt in Workstream A or not at all.

---

### D6 — TypeScript platform, matching engine behind an interface — **provisional**

**Context.** `exchange-core` (the strongest open-source matching engine found) is Java.
The team's most recent greenfield work is TypeScript.

**Decision, provisional.** Build the platform in TypeScript. Implement the matching engine in
TypeScript behind a narrow interface, using `exchange-core` and LMAX Disruptor as design
references rather than dependencies. Replace with a JVM or Rust implementation only if measured
load demands it.

**Consequence.** P99 < 150 ms (`PRD.md` §12) is achievable in Node at Phase 2 volumes; a
polyglot runtime bought on day one is a cost with no measured justification. The interface is the
hedge. **Confirm before scaffolding** — this is the one decision here that is a preference rather
than a constraint.

---

### D7 — Hyperswitch for PSP orchestration

**Context.** `PRD.md` §11.2 requires multi-PSP with routing and failover, never single-source —
losing payment rails is an existential risk (§15).

**Decision.** Hyperswitch (Apache 2.0, Rust) as the orchestration layer.

**Consequence.** It implements rule-based, volume-based and cost-optimised routing with automatic
failover and retry, rather than us approximating it. Adds a service to operate; the alternative is
writing routing logic that will be worse.

---

### D8 — immudb for the audit log

**Context.** `PRD.md` §11.10 requires an immutable audit log of every back-office action —
the first artefact an auditor requests, and impossible to reconstruct after the fact.

**Decision.** immudb (Apache 2.0), which added built-in immutable audit logging and PostgreSQL
compatibility in v1.11.

**Consequence.** Upgrades the claim from "we log admin actions" to "admin actions are provably
untampered", which is a materially different conversation in an audit. Cryptographic verification
per transaction.

---

### D9 — Temporal for long-running money workflows

**Context.** Settlement runs, payout approvals, KYC escalation, manual review queues and bonus
wagering are all long-running and all need compensation on failure.

**Decision.** Temporal (MIT) for durable execution of these flows.

**Consequence.** Removes an entire class of half-completed-money-operation bugs. Another service
to operate.

---

### D10 — Aggregate casino content; never integrate studios individually

**Decision.** One aggregator integration (SoftSwiss / EveryMatrix class), not per-studio.

**Consequence.** Hundreds of certified titles for one integration. Certification is the point —
no operator-controlled RTP, no uncertified in-house games, unlike the reference platforms' "our
casino" pattern. Provider callbacks must be idempotent by transaction ID; duplicates are routine
traffic, not an exceptional case.

---

### D11 — Exchange is Phase 2 and gated on a liquidity commitment

**Context.** An empty order book is worthless and users do not return after seeing one. This is
the existential risk for the differentiating module (`PRD.md` §15).

**Decision.** The exchange does not enter public beta until market-making is solved
**contractually**. Phase 2 entry gate, not an engineering milestone.

**Consequence.** Sportsbook and casino ship first and fund the liquidity problem. If no
market-maker relationship materialises, the exchange is reconsidered rather than launched empty.

---

### D12 — Funds reserve at submission, not at match

**Context.** An exchange order can rest unmatched for hours, and lay liability is
`(odds − 1) × stake`, not the stake.

**Decision.** Reserve at submission. A resting unmatched order still holds its reservation.

**Consequence.** Prevents a user submitting more resting liability than they can cover, which
would otherwise only surface at match time — potentially in-play, potentially across several
markets at once. Costs users available balance while orders rest; that is correct, and the UI
must make reserved-vs-available unambiguous.

---

### D13 — Jurisdiction is configuration, never a fork

**Context.** Market types, limits, RG defaults, KYC timing, bonus rules and reporting all vary by
member state. Germany (`PRD.md` §10.3) is the extreme case: €1 max slot stake, 5-second minimum
spin, no live casino under the sportsbook licence, cross-operator deposit cap via LUGAS.

**Decision.** All of it is per-jurisdiction config resolved through one module. A second market
must not require a second code path.

**Consequence.** Germany is the stress test — **if the DE ruleset cannot be expressed as config,
the config model is wrong** and needs redesigning before a second market, not after. Costs
up-front abstraction work in Phase 0 that a single-market launch would not strictly need.

---

### D14 — Compliance gates fail closed; self-exclusion has no override in code

**Decision.** Age, identity, jurisdiction, self-exclusion and limit checks run before the action.
Any error or timeout blocks the action. The capability to reverse a self-exclusion early **does
not exist** — not behind a permission, a flag, or dual authorisation.

**Consequence.** A gate that cannot reach a national self-exclusion register refuses rather than
allowing through and logging. Build it so early reversal is an impossible request rather than a
refused one — the alternative is a support process that will eventually be socially engineered.

---

### D15 — Do not buy, reuse or study the white-label clone stack

**Context.** "Diamond Exchange clone" platforms are openly sold by several vendors, one listing at
$1,500. Buying one would appear to accelerate Phase 1.

**Decision.** Excluded from procurement entirely, including for unrelated components.

**Consequence.** The architecture is built *around* the credit-agent model, has effectively no
KYC/AML/RG layer, and could not pass an MGA or UKGC platform audit without being rewritten to its
foundations — cheaper to build clean than to remediate. Separately, engaging a vendor from that
segment creates a supplier relationship that surfaces during licensing due diligence. Nulled
"exchange script" dumps are additionally a malware vector, and worst precisely in money-handling
code.

---

### D16 — Modular monolith, with only the matching engine extracted

**Context.** The obvious default for a platform this size is a service per domain. The team's prior
work provides a direct counter-example: 19 microservices communicating over synchronous HTTP with
no queue, one service calling fifteen others, and cross-database reads for config.

**Decision.** The platform ships as one horizontally-scaled deployable with lint-enforced module
boundaries. The **matching engine** is the only extracted process. Workers (Temporal) run
separately.

**Consequence.** The boundaries we need are compile-time boundaries, and lint gives those for free
— a service-per-domain split would pay full distribution cost (latency, debugging, deployment,
partial failure) for coupling it does not actually remove. The matching engine is extracted because
it is a genuinely different kind of thing: stateful in-memory book, single-writer per market,
latency-critical, scaling on market count rather than request volume. Extraction of other modules
stays cheap because they already communicate through published interfaces — deferred until there is
a measured reason, not a suspected one.

---

### D17 — Money crosses the Postgres/TigerBeetle seam by intent-then-execute

**Context.** D5 puts state in Postgres and funds in TigerBeetle. Two stores holding one truth is
the highest-risk seam in the system. Naive sequential writes ("dual-write") produce either a bet
recorded but unfunded, or funds moved with no record of why — neither detectable without
reconciliation, both involving real customer money.

**Decision.** One pattern everywhere, no exceptions:

1. Postgres transaction inserts a `money_operation` row — status `PENDING`, caller idempotency key,
   and a **precomputed** TigerBeetle transfer ID — alongside the domain row. Commit.
2. Execute the transfer against TigerBeetle using that precomputed ID.
3. Mark the operation `COMPLETE` or `FAILED`.
4. A continuously-running sweeper resolves anything left `PENDING` by looking the transfer up by ID.

**Consequence.** TigerBeetle transfers are idempotent by ID, so step 2 is retry-safe by anyone —
the caller, a retry, or the sweeper — and converges on one outcome. There is no crash window that
produces money without a record, because the record commits first and the money is deterministic
from it. **The sweeper is part of the design, not a safety net**, and ships in Workstream A5 rather
than being added when breaks appear. Reservations become real ledger accounts rather than columns,
so exposure is provable instead of computed.

---

### D18 — Compliance state changes revoke live sessions, not just future requests

**Context.** Adversarial review of the architecture surfaced this. Gates that run before each
action look correct in any request-scoped test, but a user who self-excludes, is suspended, or
trips a limit may be holding an open session, a live WebSocket and resting exchange orders.

**Decision.** Compliance state changes publish a revocation event that terminates the user's
sessions, closes their streams, and cancels or freezes resting orders according to the reason code.
The per-request gate remains, as the last line rather than the first.

**Consequence.** Without this, "self-excluded" means "cannot start a new action" while the user
continues receiving prices and holding live market positions — which is a reportable breach, not a
UX gap. Adds a revocation channel and requires every long-lived connection to be addressable by
user.

---

### D19 — TigerBeetle ledger spike — **DECISION PENDING, do not start A3.1 without it**

**Context.** `PRD.md` §11.2 referenced a decision that did not exist. This entry closes that
dangling reference and records what the spike must resolve. A multi-agent review on 2026-08-04
verified TigerBeetle's semantics against its official documentation and found that **the
reservation design in D12 does not work as specified.**

**Primary-source verification.** All quotes below were fetched directly from TigerBeetle's official
documentation on **2026-08-04** and are verbatim. This is not agent-reported; it is checkable.

| # | Verbatim quote | Source | Consequence |
|---|---|---|---|
| 1 | *"If the posted `amount` is less than the pending transfer's amount, then only this amount is posted, and **the remainder is restored to its original accounts**."* | [two-phase-transfers](https://docs.tigerbeetle.com/coding/two-phase-transfers/) | A partial fill silently releases the entire unmatched remainder to spendable cash |
| 2 | *"A pending transfer can only be posted or voided **once**. It cannot be posted twice or voided then posted, etc."* | same | The second fill on the same order cannot be captured at all |
| 3 | *"If the timeout interval passes before the transfer is either posted or voided, the transfer expires and **the full amount is returned to the original account**."* | same | A resting order outliving its timeout becomes unfunded, silently |
| 4 | *"Zero denotes absence of timeout."* | [transfer reference](https://docs.tigerbeetle.com/reference/transfer/) | `timeout = 0` is mandatory on any wager-lifetime reservation |
| 5 | *"This is an identifier that partitions the sets of accounts that can transact with each other"* — and `ledger` *"must match the `ledger` value on the accounts referenced in `debit_account_id` **and** `credit_account_id`"* | same | **Cross-currency transfers are impossible.** An exchange order book cannot match a EUR user against a SEK user |
| 6 | *"Must not conflict with another transfer in the cluster"* · *"transfer IDs are unique for the cluster – not the ledger"* · the application developer chooses the id | same | The precomputed-id scheme is permitted, but uniqueness is cluster-wide |
| 7 | *"The `Transfer.id` associated with this particular attempt will **always fail upon retry, even if the underlying issue is resolved**. To succeed, a new idempotency id must be submitted."* | [create_transfers](https://docs.tigerbeetle.com/reference/requests/create_transfers/) | **D17's sweeper retry path is permanently poisoned** once a transfer id fails on a transient error such as `exceeds_credits` |

Quotes 1–3 together are why the reservation design fails; quote 7 is why the recovery path fails;
quote 5 is why currency is a Phase-0 decision rather than a Phase-3 one.

A €500 lay reserving €550 as one pending transfer, filling €120: TigerBeetle posts €132 and
**returns €418 to spendable cash while €380 of the order still rests live in the book.** The second
fill returns `pending_transfer_already_posted`. Result is a matched, unfunded bet — which
`ARCHITECTURE.md` §3.1 itself says has no recovery. The `reserve / capture / release` vocabulary in
`MILESTONES.md` A3.3 is what points implementers at this broken mechanism.

**Open questions the spike must answer, all before A3.1:**

1. **Reservation mechanism.** Posted transfers cash→`reserved` (which `ARCHITECTURE.md` §2.3
   already asserts and A3.2 already provisions) instead of pending transfers. Confirm against a
   running cluster.
2. **Reservation granularity.** One `reserved` account per user, or per user per market? Per-order
   attribution cannot live in TigerBeetle either way, so the safety net is the invariant
   `sum(reserved_amount over open orders) == reserved account balance`, continuously checked.
3. **`timeout` must be 0** on any wager-lifetime reservation. A non-zero timeout silently voids the
   reservation under a live resting order, and expiry is near-invisible — `get_account_balances`
   does not record balances removed by expiry.
4. **`id_already_failed`.** A precomputed transfer id that fails on a transient error
   (`exceeds_credits`) can never subsequently succeed, which poisons D17's sweeper retry path
   permanently. Determine the correct id strategy.
5. **Idempotency-key uniqueness.** A4.1 specifies no unique constraint and D17 never derives the
   transfer id from the caller key — so the same key on two nodes yields two ids and a double
   debit. Decide whether the transfer id is *derived from* the idempotency key.
6. **Currency.** Fixed per `ledger` at account-creation time. Confirm the account-id scheme
   reserves space for it before any account is minted.
7. **Entry shape.** Whether the caller idempotency key, reference type and causing domain event can
   all be carried in `user_data_128/64/32`.

**Consequence.** D5 says the ledger "cannot be retrofitted cheaply; adopt in Workstream A or not at
all" — so every one of these is resolved by default, badly, the moment A3.1 is written without
them. Items 1–3 change D12's implementation; whether they change D12's *decision* is open.

---

### D20 — Corrects the credit-funding ground in D1

**Context.** D1's Consequence states credit betting is "banned" as one of five grounds for
rejecting the agent model. `PRD.md` §4.4 was corrected on 2026-08-03 to a narrower and accurate
claim, leaving the two documents contradicting each other.

**Decision.** The accurate position: **UK LCCP condition 6.1.2 bans credit *cards* as a gambling
payment method** (from 14 April 2020). That is a payment-method rule, **not** a blanket prohibition
on credit betting, and the two are routinely conflated.

**Consequence.** **D1's conclusion is unaffected and stands.** The agent model remains
unlicensable on the four other grounds — unlicensed money transmission, AML failure by
construction, self-exclusion defeat, and absence of segregated player funds — each of which is
independently sufficient. Only the reasoning changes: the card ban is evidence of regulatory
direction, not the operative prohibition. **Do not cite "credit betting is banned" as the reason.**

---

### D21 — Fancy/session markets are a per-jurisdiction question, not a universal prohibition

**Context.** D3 rejects fancy/session markets on the basis that they are "restricted or prohibited
by European regulators" and that "no amount of compliance tooling makes ball-level session markets
licensable." The 2026-08-04 review found **no rule, no regulator and no citation** behind that
claim anywhere in the document set.

**Decision.** The blanket claim is withdrawn. The correct treatment is per target market:

- **Germany operates a closed list.** §21(5) GlüStV requires each bet's *Art und Zuschnitt* to be
  authorised in advance against a published list, and GGL publishes a cricket market list. The
  answer for any given market is therefore determinate — look it up.
- **Other jurisdictions do not operate closed lists**, and no rule was found making granular
  cricket markets universally unlicensable across the EEA.

**Consequence.** D3's *decision* — exclude these markets from Phase 1 — is retained, on integrity
and operational-risk grounds rather than a claimed legal impossibility. But it is now a
**reversible commercial choice per market**, not settled law, and §7 must gain a jurisdiction
column before it can serve as the per-sprint compliance gate. Both failure directions are live:
dropping cricket on a non-existent prohibition costs as much as shipping an over-runs market that
breaches §21(1a) S.4 in Germany.

---

### D22 — Corrects the Part I platform-identity finding

**Context.** `PRD.md` §2 claimed the seven reference domains were "skins of a common white-label
platform", tagged **[V]**. Direct fingerprinting on 2026-08-04 falsified it: at least five
mutually distinct application stacks, with irreconcilable API namespaces.

**Decision.** Corrected to: **at least three distinct white-label products, at least one of which
is provably multi-tenant across four or more brands** — evidenced by a byte-identical bundle
(SHA-256 `7c847a6b…67af1a`) served under kingexch365.com, queenx247.com and t20worldexch.com, with
`siteKey`, a runtime theme API, 885 theme tokens and hardcoded sibling-brand conditionals.

**Consequence.** **D15 is unaffected and reinforced** — there is no single stack to acquire, and
the one verifiably multi-tenant product is architected around the model D1 rejects. The wider
lesson is a process one: the original claim was inference from commercial similarity presented as
verification. `CLAUDE.md` §1 exists to prevent exactly that, and it was violated in the document
that §1 governs.

---

### D23 — Corrects the German example in D13

**Context.** D13's Context cites Germany as the config stress test and gives *"€1 max slot stake"*
as its headline example. That figure was superseded in **July 2026**.

**Decision.** The current rule is **tiered and operator opt-in**: **€1** baseline for every player ·
**€3** at 21+ · **€5** after a rolling 90-day period with no problematic-gambling indicators — and
the higher tiers require **GGL approval per operator**, with an obligation to monitor player
behaviour before and after the increase
([iGaming Business](https://igamingbusiness.com/legal-compliance/regulation/germany-raises-online-slot-stake-limits-operators-to-track-player-behaviours/)).
Corroborated by trade press; **GGL primary text was not reachable — re-verify before building.**

**Consequence.** **D13's decision is unaffected and strengthened.** Jurisdiction-as-configuration
remains correct, and the stress test gets harder in a useful way: the config model must now express
four dimensions — baseline, operator approval flag, age band, and a rolling behavioural
qualification — rather than one constant. Two knock-on effects are **not** config and are recorded
as open in `docs/ARCHITECTURE.md` §12: the 90-day qualification cannot be evaluated per spin inside
the casino callback path (needs a precomputed player-tier projection, item 7), and the
cross-operator deposit cap needs a real-time LUGAS query per deposit, which is currently mis-filed
under "Regulatory reporting" in `PRD.md` §13.1.


---

### D24 — Phase 1 is cricket-only; casino and the exchange are deferred

**Context.** The client narrowed the first build to the cricket product that the reference platform
`client.top5050.in` runs (relayed 2026-08-04), answering `PRD.md` §16 Q3.

**Decision.** Phase 1 ships **cricket betting only**. The casino (general M9) and all non-cricket
sports are deferred; the true betting **exchange** is deferred to Phase 2 unchanged (D11).

**This supersedes D3's blanket exclusion of fancy/session/toss markets** — already narrowed by D21
to "a reversible commercial choice per market, not settled law." The reversal is now explicit for
cricket: **Tech builds every fancy/session market type as a config-gated capability that defaults
off; the client enables each per its licensed market** (D25 mechanics, Appendix A.5 ownership). D3's
underlying integrity concern is not dismissed — it is answered by *building the controls* (liability
caps, bet-locks, delays, integrity flags: `docs/CRICKET-MVP.md` §2.6, CM3, CM5), which the reference
platforms expose and a licensed book needs regardless.

**Consequence.** A single-sport, single-engine MVP. Much smaller than the three-engine platform, and
it front-loads the sport with the most jurisdiction-sensitive market types (fancy/session) — a
client/compliance concern, not a Tech one. Full execution spec in `docs/CRICKET-MVP.md`. Real-money
launch still requires KYC (M5), RG (M6) and payments (M7); those run in parallel and are not removed
by narrowing scope.

---

### D25 — The cricket MVP is operator-priced, which sidesteps the exchange's hardest problems

**Context.** The reference sites present cricket match-odds as a Betfair-style exchange, but that is
a pass-through to Betfair's liquidity — not licensable to resell in the EEA — and the bookmaker and
fancy markets, which are the bulk of cricket volume, are already **operator-priced** (the operator
is the counterparty).

**Decision.** Build the cricket MVP as a **fixed-odds sportsbook**: the operator prices and books
every cricket market, including match-odds. No order book, no matching, no resale of Betfair
liquidity.

**Consequence — three problems avoided, three that remain.**
Avoided: (1) the exchange liquidity bootstrap (D11) — no market-maker needed; (2) the partial-fill
reservation failure (D19, §12 item 1) — operator-priced bets reserve a **fixed, known amount at
placement** (`stake` for a back, `(odds−1)×stake` for a lay) as one posted transfer `cash→reserved`,
with nothing to partially post; (3) order-book matching entirely.
Still required and unchanged: §12 items **2** (sync money paths — a bet cannot be accepted unfunded),
**3(a)** (currency in the account scheme) and **8** (chargebacks). The cricket book also carries
**operator risk** on the highest-integrity-risk markets in sport, so the risk console and integrity
monitoring (`docs/CRICKET-MVP.md` §2.6, CM5) ship early rather than late.

---

### D26 — Cricket feed: pluggable demo source, contracted provider on prod

**Context.** Cricket engineering (XC1 onward) needs a ball-by-ball source now, but contracting an
identifiable provider with an SLA takes time. The feed adapter (XC1.1) already makes the source
swappable. The client chose to start on a third-party source and settle the production provider
later (2026-08-04).

**Decision.** The feed source is **environment-configured and pluggable**:
- **Demo / dev:** `cricbuzz11.in` *or* recorded fixtures. Play-money only, so the
  settlement-accountability bar does not apply.
- **Production (real money):** a **contracted, identifiable provider with an SLA and correction
  protocol** — SportMonks (€29–129/mo, EU, ball-by-ball, verified 2026-08-04) or CricketData.org to
  trial; premium (Sportradar/Genius) only if the SLA/rights bar demands it. Final selection is C-b.
- **A prod boot tripwire refuses to start** if the configured feed is a demo source
  (`CLAUDE.md` §3.11 config validation).
- **The adapter maps every source into our internal event schema** — modelled on the observed
  top5050 structure (`event / fancy[] / market[]`, 2026-08-04 HAR). Dev code depends on the internal
  schema, never on a provider's raw payload.

**Consequence.** Cricket engineering starts immediately without waiting on a feed contract, and the
prod swap is a new adapter file, not a rewrite — provided the schema boundary holds. The tripwire
stops the demo feed reaching production. Caveats: `cricbuzz11.in` is a third-party endpoint not
offered to us as a service and likely referrer/token-gated (like the `lt-fn` Akamai feed seen in the
HAR), so server-side pulls may be rate-limited or blocked — **recorded fixtures are the fallback and
the CI source regardless** (CM1's proof needs replayable stored events anyway). This is a demo/dev
convenience, **not** an endorsement of the source for production, and not a settlement source for
real money.

---

### D27 — D6 confirmed (no longer provisional)

**Decision.** As of 2026-08-04 the client confirmed D6: TypeScript platform, matching engine in
TypeScript behind a narrow interface, `exchange-core`/LMAX as design references, replaced with
JVM/Rust only if measured load demands.

**Consequence.** M0 scaffolding is unblocked. The "provisional" qualifier is lifted; the interface
remains the hedge.

---

### D28 — Reservation is a posted transfer into a per-user `reserved` account (§12 item 1, signed off)

**Context.** D19 proved TigerBeetle two-phase pending transfers cannot survive partial fills.

**Decision.** Reserve funds as a **posted transfer `cash → reserved`**, one `reserved` account per
user, with `timeout = 0`. Per-bet/per-order attribution lives in Postgres. A continuous invariant
holds it honest: **`sum(open reservations in Postgres) == reserved account balance`**, per user. For
cricket (operator-priced) the reservation is a single fixed amount at placement; the exchange's
partial-fill *capture* mechanics remain deferred to Phase 2.

**Consequence.** Replaces the `reserve/capture/release` two-phase vocabulary. Correctness comes from
the invariant, not from application discipline maintained forever. Unblocks A3.2/A3.3.

---

### D29 — Money paths: synchronous where funds must block, async elsewhere (§12 item 2, signed off)

**Context.** §2.2, §3.1 and §9 gave three incompatible readings of TigerBeetle-down behaviour.

**Decision.** **Synchronous against the ledger wherever insufficient funds must block the action** —
wagers, casino debits, withdrawal *reservation*. **Asynchronous everywhere else** — deposits,
withdrawal *execution*, settlement, commission. This resolves the §9 contradiction: money-committing
paths halt when TigerBeetle is unavailable; money-in paths use intent-then-execute + the sweeper.

**Consequence.** Synchronous paths bound platform availability to TigerBeetle availability — a leader
election is ~90s of refused bets. Accepted. **No path may accept an unfunded bet to preserve
uptime.** D17's "one pattern everywhere" is corrected to two, keyed on this rule.

---

### D30 — Currency encoded in the ledger/account-ID scheme (§12 item 3a, signed off)

**Context.** TigerBeetle's `ledger` field partitions accounts; cross-currency transfers are
impossible (D19 quote 5), and D5 says the account scheme cannot be retrofitted.

**Decision.** Encode currency via the TigerBeetle `ledger` field and reserve space for it in the
account-ID derivation, from the first account minted. One set of accounts per user per currency.
Book partitioning vs single-settlement-currency-with-FX (item 3b) stays deferred to Phase 2.

**Consequence.** A second currency later is new accounts on a new ledger, not a re-derivation of
live IDs. Unblocks A3.1/A3.2.

---

### D31 — Chargebacks: dispute-suspense account + `reverse`; invariant rescoped (§12 item 8, signed off)

**Context.** A chargeback on money already wagered and lost requires a negative position, which the
"no negative available balance" invariant forbade — it would fail A1.4 in CI on a real event.

**Decision.** Add a **house dispute-suspense account** and a **`reverse`** primitive to the ledger,
plus a user state carrying outstanding debt. Rescope `CLAUDE.md` §4 to **"no *wager* path permits a
negative available balance"** (not "no path"). A chargeback books to dispute-suspense, never to the
customer's spendable balance.

**Consequence.** A1.4's property test is scoped to wager paths, so it no longer fails on a real
chargeback. Unblocks A3.2/A3.3.

---

### D32 — Play-money only, forever: no real money in or out (governs scope)

**Context.** The project was specified and built as a licensed real-money betting platform. On
2026-08-04 the client confirmed the product is **play-money only, permanently** — virtual chips with
no cash value, no deposits, no withdrawals, no purchases. This is the governing scope decision and
it supersedes the real-money assumption throughout.

**Decision.** The platform is a **free-to-play virtual cricket betting game**. No real money enters
or leaves at any point or phase.

**Removed from scope** — retained in the docs as reference and for any future real-money pivot, **not
deleted** (all preserved in git):
- Gambling licence and jurisdiction as a Tech gate (PRD §10; B1 no longer blocks the build)
- KYC/AML (M5); self-exclusion registers and statutory RG (M6, D14, D18 in their regulatory sense);
  regulatory reporting (M12)
- Real payment rails and orchestration (M7; **D7 Hyperswitch — cut**)
- Chargebacks and the dispute-suspense account (**D31 — void**)
- Player-funds segregation; gaming duty; the financial model (PRD §10.4, §11.11)

**Retained:**
- The cricket engine — feed, markets, pricing, in-play, settlement — **unchanged**.
- A chip-economy ledger, with a **softened bar: game integrity (no chip duplication/loss), not
  financial-regulatory audit.** TigerBeetle (D5) and immudb (D8) are now arguably overkill — flagged
  for reconsideration against a simpler store; not yet re-decided.
- Accounts/identity — login + chip balance, no verification tiers.
- D28 (reserve chips at bet placement) and D29 (sync so a bet can't exceed the chip balance) still
  apply. **D30 collapses to a single chip currency.**
- The feed choice (D26): the accountability/SLA/licence bar **evaporates** — no money settles, so
  cricbuzz11 or any cheap feed is fine in production. **No demo-vs-prod feed distinction remains**;
  the boot tripwire is moot.

**Consequence.** A materially lighter product. No betting revenue — monetisation (ads / subscription
/ engagement) and app-store "simulated gambling" / social-casino rules are the client's business and
legal concern (Appendix A.5), not Tech's. Roughly half the prior compliance/payments scope is gone;
the cricket game itself is unchanged.

---

### D33 — Trim the infra for play-money: one Postgres store (Phase 1)

**Context.** D32 made the product play-money only. TigerBeetle (D5), immudb (D8), Temporal (D9) and
Hyperswitch (D7) were chosen for real-money settlement correctness, regulatory-grade audit, durable
money workflows and payments — none of which applies to virtual chips.

**Decision.** For the Phase-1 play-money cricket game:
- **Chip ledger = a double-entry table in Postgres. Drop TigerBeetle (D5).** Chips, bets, markets and
  the ledger all live in one store, so a bet placement or a settlement is a **single ACID
  transaction**. The entire two-store money seam collapses: no intent-then-execute, no sweeper, no
  cross-store reconciliation, no transfer-id/idempotency-key mapping. D17 and the cross-store parts
  of D28–D30 no longer apply.
- **Drop immudb (D8).** Back-office actions and chip-economy audit go to an append-only Postgres
  table — game-integrity/anti-fraud grade, not cryptographic-regulatory.
- **Drop Temporal (D9)** for a light durable job queue (pg-boss on Postgres, or BullMQ on Redis) for
  settlement jobs. The workflows are event-driven and short now, not long money sagas.
- **Drop Hyperswitch (D7) and OpenSanctions** — no payments, no sanctions screening.
- **Defer** ClickHouse (analytics), Kafka (Postgres outbox + Redis/NATS suffices), and fine-grained
  OpenFGA (basic player/admin RBAC is enough).
- **No matching engine in Phase 1** — cricket is operator-priced (D25); the matching engine is
  exchange-only (Phase 2).
- **Keep:** Postgres (everything), Redis (sessions/cache/fan-out), Centrifugo (live price/score
  push), lightweight auth (Ory Kratos or similar, no verification tiers), the cricket feed adapter,
  TypeScript (D27).

**Consequence.** The trimmed stack is essentially **Postgres + Redis + Centrifugo + a job queue +
auth.** The hardest part of the project — the two-store money seam and its failure modes — is gone.
D28 (reserve chips) and D29 (no overspend) hold as ordinary in-transaction logic; D30 (currency) and
D31 (chargebacks) are moot/void. Double-entry discipline is retained as a Postgres table (the chip
ledger is still the only authority on chips, still balanced, still append-only). `ARCHITECTURE.md`
§2/§12's two-store design is retained as the real-money reference, superseded for Phase 1.

---

### D34 — In-house session auth (scrypt), not Ory Kratos (M2, play-money)

**Context.** M2 needs accounts + sessions. The earlier note said "Ory Kratos or similar." For a
play-money game (no real money, no payments, minimal PII — D32) a full external identity service is
over-weight, and D33's trim philosophy applies.

**Decision.** In-house session auth: **Node-core `crypto.scrypt`** for password hashing (per-user
salt, `timingSafeEqual` compare — no native dependency); **opaque 256-bit session tokens** stored as
their SHA-256 in a `user_session` table with expiry; httpOnly cookie transport. Suspend revokes all
of a user's sessions; a password change revokes the others. Account states `ACTIVE · SUSPENDED ·
CLOSED`.

**Consequence.** Light, transparent, verifiable, no external service. **This is play-money-grade
auth** — adequate because there is no real money, PII-heavy data, or payment surface (D32). A future
real-money pivot must add a proper security review and likely MFA/email-verification (all deferred
now as over-build). Rolling auth is a known footgun; the mitigations above are deliberately standard.

---

### D35 — Fancy/session settlement semantics + compensating resettlement (CM4)

**Context.** CM4 settles fancy/session markets (the only ones with bets — CM3) from the append-only
`raw_ball_event` store, and must be able to *correct* a settlement (third-umpire change) without
ever editing a ledger entry (§4: "corrections are new compensating entries; nothing is updated").
None of this was previously specified, so the semantics are decided here rather than assumed.

**Decision.**
1. **Binary outcome.** For a bet struck at `line_value` L with actual session runs R: a **back**
   wins iff `R ≥ L`; a **lay** wins iff `R < L`. The `≥` boundary favours the back (documented, not
   incidental). A bet is settled against **its own struck line**, never the market's repriced line.
2. **Actual runs = innings 1, overs `< window`.** Session markets model the first-innings block
   (e.g. "6 over runs"). Multi-innings/second-innings session lines are deferred (needs an `innings`
   column on `fancy_market` + a resolver arg) — not built, must not be claimed.
3. **Window complete** when legal balls in the window `≥ overs×6`, **or** innings 1 has ended
   (a ball with `innings ≥ 2` exists, or 10 wickets fell) → settle at runs so far. Never settle an
   incomplete window (no fabricated result — §3.10); return a typed `pending`.
4. **Settlement money is the one ledger.** One pure `settlementEntries(outcome,…)` mapping
   (`won→payout`, `lost→capture`, `void→release`) is shared by `settle` and `resettle` — no second
   formula (§3.2). Per-bet idempotency key `settle:<betId>` makes re-runs no-ops (replayable).
5. **Resettlement = one compensating txn**: `[...reverseEntries(old), ...new]` in a single ledger
   transaction. The reserved legs cancel, so the reservation stays `settled` and the reserved
   balance is untouched — the §4 reservation invariant holds. Entry **order matters** (reverse
   first, else `reserved` transiently underflows the non-negative guard).
6. **Play-money clawback limit.** A correction that would claw back more chips than the player
   currently holds (won→lost after they spent it) **fails closed** (`LedgerError`) — there is no
   suspense/negative-balance path (D31 void under D32). Accepted limitation, not a bug.
7. **Trigger + audit.** `settleDueMarkets(matchId)` is called after ingest (durable job-queue
   trigger deferred — no queue built yet, D33). Manual overrides (void/resettle) record actor+reason
   via `IdentityRepo.audit` (the shared `AuditService` is extracted at CM5); **dual-auth SoD
   enforcement** (approver ≠ adjuster) is CM5, not CM4.

**Consequence.** Settlement is a pure fold over stored balls plus the single ledger, so it is
replayable and auditable — the audit posture an operator/regulator wants. The deferred items
(multi-innings, clawback suspense, job-queue trigger, SoD) are listed in `docs/CRICKET-MVP.md` CM4
and must not be presented as done.

---

### D36 — Trading console: C4 audit wrapper, requireRole, SoD dual-auth (CM5)

**Context.** CM5 gives operators the console to suspend/void/resettle, with the audit posture a
licensing review checks: attributable, immutable, before/after, and **four-eyes on money moves**.
CM4 already built the *mechanics* (`voidFancyMarket`, `resettleFancyMarket`, market suspend) but with
no authorization, no segregation of duties, and audit scattered in `IdentityRepo.audit`.

**Decision.**
1. **One audit path (C4).** A shared `AuditService` (new `features/audit/`) is the single writer to
   the append-only `audit_log`, recording `{actor, action, subject, before?, after?, reason?}`. The
   two existing writers — M2 `AuthService`, CM4 `SettlementService` — migrate onto it and
   `IdentityRepo.audit` is removed (rule-of-three; the extraction `identity.repo` flagged for CM5).
   Every back-office action writes through it (XC5.5).
2. **One role policy (rule 9).** A single `@Roles(...)` decorator + `RolesGuard` in identity, layered
   after `SessionGuard`, resolves the caller's `app_user.role` and gates the console to `trader`/`admin`.
   No feature re-checks roles.
3. **SoD dual-auth on money overrides.** An `operator_action` row (kind `void`|`resettle`) is
   **proposed** by an adjuster and **approved by a different operator**, which executes it via CM4.
   `approve` throws `SoDViolationError` if approver = proposer — segregation expressed in exactly one
   place. Suspend/reopen (reversible, no money) are single-auth + audited.
4. **Exposure views reuse the single owners.** `calculateOperatorLiability` (book) and
   `calculateCustomerExposure` (user) — no second formula (§5 rules 2/11); match-level aggregates the
   per-market values.
5. **Integrity flags are review heuristics, not verdicts** — a pure detector over a market's session
   bets (e.g. single-user concentration) that *surfaces* patterns for a human; it blocks nothing.

**Deferred (not built, not the proof):** **per-user stake factoring** (XC5.3, also the CM3 XC3.7 gap)
— touches placement, and is not in the CM5 proof; it lands as a focused follow-up. HTTP e2e for the
console (service + role-gated controller are built and integration-tested; no running-server test yet).

**Consequence.** The console reuses CM4's settlement mechanics behind authz + four-eyes + a single
immutable audit trail — the review artefact an auditor asks for first. SoD lives in one method; roles
in one guard; audit in one service.
