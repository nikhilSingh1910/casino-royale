# REVIEW FINDINGS — compiled, not applied

**Nothing in this document has been applied to any specification file.** This is the raw
compilation for review. Source documents are untouched.

| | |
|---|---|
| Run | `wf_1efd7458-126`, 11 agents, 1.42M tokens, 719 tool calls, 77 min |
| Findings | **142** — 23 critical · 55 high · 46 medium · 18 low |
| Method | 6 reference-inventory agents (public research, no authentication) + 5 verification/audit agents |
| Evidence standard | Every finding required a fetched URL and a verbatim supporting quote |

**Reliability note.** These agents had no access to our conversation. They do not know which
omissions were deliberate, which items were already on my fix list, or why certain decisions were
made. §10 sorts every finding into *trust directly*, *needs my verification*, or *agent lacked
context*. Read §10 before acting on anything.

---

## 0. Verdict

The specification's **structure** holds up: the three-engine model, the modular monolith, the
intent-then-execute seam concept, the compliance-as-architecture stance, and the §7 disposition
table all survived scrutiny. No agent proposed a different shape.

The **details do not**. Three categories of failure:

1. **The money design does not work as written.** The reservation mechanism is incompatible with
   partial fills — the core exchange mechanic. This is not a detail; it invalidates D12 as
   specified. Four independent criticals converge on it.
2. **Two headline factual claims are false.** The seven reference sites are not one platform, and
   two named German payment rails no longer exist.
3. **The documents contradict each other in ~22 places**, several of which I introduced during
   this session's edits.

---

## 1. HEADLINE CLAIM FALSIFIED — the seven sites are not one platform

`PRD.md` §2 asserts, tagged **[V]**: *"They are skins of a common white-label platform."*
**This is false.** [C55/H55, platform-identity + design-parity]

Direct fingerprinting of all seven public landing pages found **at least five mutually distinct
application stacks**:

| Domain | Stack |
|---|---|
| kingexch365.com | nginx + Angular 17.3.1 |
| diam247x.com | S3/CloudFront + Vue + jQuery + socket.io + protobuf |
| tiger365.pro | Laravel/PHP (Laravel-encrypted `XSRF-TOKEN`, `ex_session`) |
| thelotus247.com | 301 → lotusbook.cricket, Next.js |
| coexch777.co + coexch9.co | CNAME into a numbered Cloudflare tenant family |
| abexch365.com | dead |

API namespaces are irreconcilable: Family A uses `/api/exchange/*`, Family B uses `/api/client/*`.

**But the underlying insight survives in stronger form.** Family A *is* a proven white-label:
`main.f3c5a4b8eb7bccdf.js` is **byte-identical (SHA-256 `7c847a6b…67af1a`) across kingexch365.com,
queenx247.com and t20worldexch.com**, served from three separate AWS ap-south-1 IPs. The landing
HTML diffs empty between two of them. The bundle carries `siteKey:"2"`, a runtime theme API, **885
CSS custom properties**, and hardcoded per-brand conditionals naming sibling tenants:

```js
checkToAddSignup(){ ...["https://queenx247.com"].includes(a)&&this.customerHelp() }
checkDomain(){ ...return!!["https://t20worldexch.com"].includes(Dt) }
```

**Corrected claim:** *not* one platform with seven skins, but **at least three different
white-label products, one of which is provably multi-tenant across ≥4 brands.**

**This strengthens rather than weakens the "don't buy the stack" conclusion (D15)** — there is no
single stack to buy, and each tenant ships its competitors' feature flags.

### 1.1 Bonus: the real module inventory

Family A's bundle contains a complete endpoint map — the most precise available answer to "what
does this product actually do", far better than my inferred inventory:

- **Markets** — `sportsList`, `matchodds/allEventsList`, `markets/fancyMarketList`,
  `getBallByBallMarket`, `racingEventsList`, `virtualSportsList`, `lotterySportsList`, `specialEvents`
- **Money** — `deposit/createDepositTransaction`, `withdraw/withdrawalRequest`,
  `withdraw/addWithdrawalBank`, `withdraw/calculateWithdrawAmt`, `transfer/getTransferCharges`
- **Betting** — `placebet`, `lotteryPlaceBet`, `ballbyPlacebet`, `userBetStakeList`
- **Reporting** — `pl/getFancyPl`, `pl/getBookmakersPl`, `pl/marketFancyBook`, `userEventsExposure`,
  `userActivityLogs`
- **Commission** — `commission/betsRollingCommission`

**Realtime odds run on Google Firestore**, with collections literally named `Betfair`,
`Bookmakers`, `Fancy`, `Sportsbook`, `Lottery`, `tennisScore`. Material for us: copying that design
inherits a US-cloud realtime dependency with data-residency consequences.

**Family B (diam247x)** has modules Family A lacks entirely: `bonus_rules`, `cash-out-new`,
`fast-cash-out`, `market-analysis`, `multi-market`, `refer-and-earn`. Transport is Pusher.

---

## 2. CRITICAL — the money design (C1–C8)

### C1–C4 · Reservations break on partial fills — **the most serious finding in the review**

`D12` reserves funds at submission. `MILESTONES` A3.3 names primitives `reserve, release, capture`.
That vocabulary implies TigerBeetle **two-phase pending transfers**. It cannot work:

> *"If the posted `amount` is less than the pending transfer's amount, then only this amount is
> posted, and **the remainder is restored to its original accounts**."*
> *"A pending transfer can only be posted or voided **once**."*
> — [two-phase-transfers.md](https://docs.tigerbeetle.com/coding/two-phase-transfers/)

**Failure:** €500 lay at 2.10 → reserve €550 pending. Fills €120 → post €132; TigerBeetle
**restores the other €418 to spendable cash** while €380 of the order still rests live. User can
withdraw it. Second fill returns `pending_transfer_already_posted`. Result: a matched, unfunded
bet — which `ARCHITECTURE.md` §3.1 itself says has *"no recovery."*

This breaks CLAUDE.md §4's **"No credit, ever"** invariant via the database's own semantics.

**C2/C4 — the timeout variant.** If reservations carry a non-zero `timeout`, an ante-post order
resting 3 days has its reservation silently voided at expiry. No domain event, no state change,
nothing watching (the `money_operation` row is already `COMPLETE`). Worse, expiry is near-invisible:
`get_account_balances` does not record balances removed by timeout expiry. `ARCHITECTURE.md` §9's
*"reservations already durable in ledger"* is true only until the clock runs out.

**The fix is already in our own docs.** `ARCHITECTURE.md` §2.3 says *"Reservations are ledger
accounts, not columns"* and A3.2 provisions a `user reserved` account. Use **posted transfers
cash→reserved**, not pending transfers. Mandate `timeout = 0` everywhere. The reserve/capture/release
vocabulary in A3.3 must be rewritten — it is what points implementers at the broken mechanism.

### C5 · D17's retry path is permanently poisoned

`id_already_failed` is returned forever once a transfer id fails on a *transient* error
(`exceeds_credits`, etc.). Two orders submitted in the same second: T2 rejected for insufficient
funds, process dies before writing `FAILED`. Sweeper retries T2 → `id_already_failed`, forever, even
after the user deposits €500. The `money_operation` row can never reach `COMPLETE`, and the order
row committed alongside it is orphaned.
[create_transfers reference](https://docs.tigerbeetle.com/reference/requests/create_transfers/)

### C6 · Same idempotency key on two nodes = double debit

A4.1 lists `money_operation` columns but **specifies no uniqueness constraint**, and D17 never says
the transfer id is *derived from* the idempotency key. Casino callback TX-123 times out, retries to
node B while node A is mid-transaction. Two distinct transfer ids, two rows, two transfers, both
`created`. **Player debited €50 for a €25 spin.** The ledger balances perfectly — double-entry does
not mean double-spend-free — and A5.2 reconciliation sees two valid operations.

### C7 · Currency does not exist in the money model

Grep across all seven files: currency appears **twice**, both in PRD prose. A3.2's account model has
no currency dimension; A4.1 has no currency column; D5 and D17 never mention it. TigerBeetle fixes
currency per `ledger` at account creation. Adding SEK in Phase 3 means re-deriving every account id
in a live ledger — exactly what D5 says is impossible. **Second-order:** an order book cannot match
a EUR user against a SEK user, so the book must be currency-partitioned, fragmenting the already-thin
liquidity.

### C8 · Cancel release computed outside the single writer

§9 claims single-writer-per-market resolves the fill/cancel race. It does not: the engine orders
events *inside the engine*, but the **release amount is computed in the platform process from a
stale read model**. Cancel arrives 1ms after a €120 fill; API's projection is 50ms stale; releases
the full €550. €132 belonging to a matched bet becomes withdrawable.

---

## 3. CRITICAL — regulatory facts (C9–C11)

| # | Claim | Verdict | Correction | Source |
|---|---|---|---|---|
| **C9** | "AMLD5/6" as the framework | **OUTDATED** | AMLD4/5 repealed by Dir (EU) 2024/1640; substantive obligations move to **Regulation (EU) 2024/1624 (AMLR)**, directly applicable **from 10 July 2027**, naming gambling providers as obliged entities with a **€2,000** occasional-transaction threshold. AMLA supervises from 2028. Given the 4–12 month licence timeline, **this platform goes live under AMLR, not AMLD5.** Also stop writing "AMLD6" — ambiguous label. | [EUR-Lex 32024R1624](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32024R1624) |
| **C10** | Sofort as a German rail | **WRONG** | *"SOFORT has been discontinued as of 31 March 2025."* Delete it. | [Stripe docs](https://docs.stripe.com/payments/sofort) |
| **C11** | Giropay as a German rail | **WRONG** | *"No new business onboarding or transactions will be possible after June 30, 2024."* Scheme wound up end-2024. Delete it. | [Stripe docs](https://docs.stripe.com/payments/giropay) |

> Both named German rails dying inside 12 months is the strongest possible argument for D7
> (Hyperswitch) and for treating **every** named rail as a replaceable adapter with a documented
> decommission path.

---

## 4. CRITICAL — compliance holes (C12, C16, C17, C20, C21)

**C12 · Self-exclusion + positive balance + open positions is an unresolvable deadlock.**
User holds €5,000 withdrawable, €800 reserved across unsettled bets, self-excludes 12 months. Login
blocked (§11.7), session terminated (D18), no reversal (D14). **There is no authenticated surface
from which to withdraw, and no operator workflow that pays out.** L3 grants only "scoped adjustments
with reason codes" — that moves a ledger balance, it does not pay a payment instrument. The three
unsettled bets have no defined disposition: void-and-refund / run-to-settlement-then-hold /
run-and-pay are three different ledger outcomes and **none is chosen**. Money stranded 12 months.

**C16 · The German cross-operator cap is not configuration.** D13/M3 claim it as pure config. It
requires a **real-time LUGAS query per deposit**. LUGAS is mis-filed in §13.1 under "Regulatory
reporting", so it lands in workstream M in Phase 1 — *after* payments (M7) has shipped a deposit path
with no cross-operator gate, and after M3 certified the config model complete. No fail-closed rule
exists because LUGAS isn't in the gate inventory.

**C17 · Chargebacks appear nowhere.** `grep -ril chargeback` across all seven files returns nothing.
A chargeback on a deposit already wagered and lost **requires** a negative available balance — which
the A1.4 property test is written to prove impossible. Either CI fails on a real production event, or
the debt is booked to a house account and becomes invisible to the ledger CLAUDE.md §4 calls the only
money. Neither A3.2 nor A3.3 can express it.

**C20 · The GDPR/AML split is not implementable against the chosen stores.** "Behavioural data" is
to be erased — but it lives in ClickHouse and *is the same corpus* that produces the RG intervention
records the regulator can demand under G3. Erasing destroys compliance evidence; retaining ignores
the request. Identity and transaction records sit in TigerBeetle and immudb, chosen precisely because
deletion is impossible or detectable — so even the retained set cannot carry a post-hoc legal-basis
marker.

**C21 · Self-exclusion checks shrink 4 → 3 → 2 across documents, and the architecture caches to
session.** PRD §11.1 says four touchpoints (registration, login, deposit, wager); PRD §10.2 and
MILESTONES F6 say three (registration dropped); ARCHITECTURE §5 says two, **cached to session**. User
logs in 19:00, self-excludes at another licensee 19:40 — this platform never re-checks and keeps
taking bets for the session TTL. That is the "allow through and log" behaviour CLAUDE.md §4 forbids,
and the exact scenario D18 exists to prevent.

---

## 5. CRITICAL — document integrity (C13, C14, C15, C18, C19)

| # | Defect |
|---|---|
| **C13** | `PRD.md` §11.2 cites **D20, which does not exist** — DECISIONS ends at D18, and STATE asserts the log is complete. A developer starting M1 finds the entry-shape question unresolved with no owner, and resolves it by default at the moment D5 says it becomes unfixable. *(Known — I introduced this.)* |
| **C14** | **Beta-exit spread contradicts across three documents.** PRD §9.3 says <5% on one seeded market; PLAN:135 and MILESTONES:293 both gate on <2% on top-3 football *while citing §9.3 as authority*. A 3.5% beta passes the PRD and fails the gate teams actually run against. *(I introduced this when I split the metric.)* |
| **C15** | **M3's proof encodes the superseded flat €1 German stake.** The milestone exists to stress-test the config model against a hard rule; testing it against a constant when the real rule is a function of (age band, 90-day harm history) validates the wrong thing, then declares the config model correct and load-bearing. |
| **C18** | **ARCHITECTURE §2.2's own sequence diagram violates ARCHITECTURE §2.3 and CLAUDE.md §3.3** — it shows `service` calling Postgres and TigerBeetle directly. C1.3's lint rule ("nothing outside `ledger/` imports the ledger client") would reject a PR written from the diagram. Likely outcome: a lint exemption carved into the money path. |
| **C19** | **TigerBeetle-down behaviour is specified three incompatible ways.** §9 says no bet accepted (fails closed). §2.2's intent-first design says commit the intent and let the sweeper reserve later — which accepts unfunded orders for the duration of a 90s leader election. §3.1 shows a synchronous reserve. Three readings, opposite production behaviour, on the highest-risk failure in the system. |

---

## 6. CRITICAL — parity and design (C22, C23)

**C22 · No design specification exists anywhere — and 1:1 design parity is the stated goal.**
`PRD.md` §5.1's entire layout spec is one sentence; §5.4's entire bet-slip spec is seven bullets.
CLAUDE.md §7 allocates `shared/ui/` with no contents. No design milestone, no design proof.
Engineering reaches a screen in M8 and invents one — rework lands after the ledger and matching
engine are built.

**The agent extracted real values** from kingexch365.com's public theme tokens (808–885 CSS custom
properties) and Angular bundle, unauthenticated: Bootstrap 12-col, left tree `col-lg-3`, centre
`col-lg-6`→`col-lg-7`, and the full token set. **This is a usable specification we did not have.**

**C23 · The blanket rejection of fancy/session markets has no regulatory citation and is false as a
universal claim.**
PRD §5.3 and D3 assert *"no amount of compliance tooling makes ball-level session markets
licensable"* — **no rule, no regulator, no URL, anywhere.** The correct answer is jurisdictional:

- **Germany operates a closed list.** §21(5) GlüStV requires each bet's *"Art und Zuschnitt"* to be
  pre-authorised against a published list — and the regulator **publishes a cricket market list**
  (`gluecksspiel-behoerde.de/images/pdf/sportarten/Wettmärkte Cricket.pdf`). So in DE the answer is
  determinate and checkable, not a judgement call.
- Other jurisdictions do not operate closed lists, and the agent found no rule making granular
  cricket markets universally unlicensable.

**Both failure directions are live:** the client drops cricket from the business case based on a
non-existent prohibition, *or* a developer reads "restricted" as "permitted with care" and ships an
over-runs market that breaches §21(1a) S.4 in Germany.

---

## 7. HIGH severity — 55 findings

**Money / exchange (H01–H16)** — reservation completes while the order never reaches the book
(H04); sweeper's "absent → FAILED" races an in-flight transfer and can double-release (H05); reserved
funds carry no cash/bonus provenance so void cannot restore the split (H06); **directional rounding
has no residual account, and in a peer-to-peer exchange the payout residual has no funder** (H07);
bet-delay/reservation ordering unspecified and one ordering permits over-commitment (H08); **exposure
is net-per-market while funds are reserved gross-per-order — two different numbers, both shown to the
user** (H10); commission on net winnings is not computable pre-bet as a single number (H11); a
partially matched order cannot be voided within the stated lifecycle, and multi-price fills are
unrepresentable (H12); voiding one side of a matched bet leaves the counterparty with no counterparty
(H14); the matched-price rule is never stated, so price improvement strands reserved funds (H16).

**Regulatory (H17–H24)** — duty table has only 3 markets and no exchange-commission row (H23, H53);
UK remote betting duty misnamed and unverified (H17, H53); LUGAS mis-filed (H19, H22); self-exclusion
touchpoints overstated (H20); register-unreachable behaviour asserted without a regulator source
(H21); **B2B-vs-licensee question raised in three places and never resolved anywhere** (H24).

**Document integrity (H25–H47)** — CLAUDE.md §5 rule 2 conflates customer exposure with operator
liability (H25) *(already on my fix list)*; **CLAUDE.md §3.1's tick-index rule makes ordinary
sportsbook feed prices unrepresentable** (H26, H54) *(already on my fix list)*; PLAN Workstream D
codes `D1/D2/D3` collide with decisions `D1/D2/D3` in a table whose notes cite D13 (H33); MILESTONES
M12 task codes `M1–M4` are textually identical to milestones `M1–M4` (H34); STATE blockers `B1–B5`
collide with PLAN items `B1–B4` (H35); **"Phase 0 is entirely jurisdiction-independent" is false in
three concrete ways and the three documents asserting it disagree on its scope** (H32); PRD §16 Q1
says build nothing before jurisdiction, STATE/PLAN/MILESTONES all say start now (H37); `COOLING_OFF`
used as an account state while §11.7 defines it as a per-limit timer, and time-out — a real state —
is missing (H38); **every [V] tag in Part II is uncited because §18 scopes sources to Part I only**
(H47).

**Unscheduled work (H27–H31, H36, H40–H45)** — multi-accounting disposition (H27); affordability data
source (H28); **player-funds segregation, written into §11.11 precisely because nothing specified it,
is still in no workstream** (H30); the A3.2/A3.3 account model cannot express deposits, bonus grants,
chargebacks or goodwill adjustments (H31); bonusing and affiliates unscheduled while CLAUDE.md
mandates modules for both (H36); certification environment is a Phase 1 gate condition with no
milestone or lead time (H40); complaints/ADR, T&C versioning, dormant accounts (H41); DR, pen-test,
data residency, availability — stated as NFRs with no task or owner (H42).

**Parity (H48–H55)** — **§7 is designated the per-sprint compliance gate but has no jurisdiction
column, so it will pass features illegal in the chosen market** (H48); **Germany prohibits cash-out on
all sports bets — the spec builds it (I5) and M3's German proof does not test for it** (H49); D1 says
credit betting is banned while PRD §4.4 now says the opposite, and neither cites the rule that
actually prohibits chip issuance (H51) *(I created this by fixing §4.4 without amending D1)*.

---

## 8. AGENT DISAGREEMENT — needs my adjudication

**The German tiered slot-stake rule.** Three findings, three positions:

- **C15 / H18** (compliance-docs, regulatory): the flat €1 is superseded; the tiered
  €1/€3/€5 rule is correct and M3's proof should encode it.
- **H50** (design-parity): the tiered claim in §10.3 is tagged **[V]** but *"contradicts the
  regulator's own current published text."*

These cannot both be right, and it is load-bearing — M3's exit gate depends on it. **I will verify
this against the GGL primary source myself before anything is changed.**

---

## 8b. PRIMARY-SOURCE VERIFICATION LOG — 2026-08-04, post-review

Every claim below was fetched directly from the primary source and quoted verbatim before any
document was changed. **Agent-reported is not the same as verified**, so the load-bearing claims
were re-checked independently.

### Verified ✅

| Claim | Source | Result |
|---|---|---|
| TigerBeetle: partial post restores the remainder | [two-phase-transfers](https://docs.tigerbeetle.com/coding/two-phase-transfers/) | **Confirmed verbatim.** C1–C4 stand |
| TigerBeetle: pending transfer postable once only | same | **Confirmed verbatim** |
| TigerBeetle: timeout expiry returns the full amount | same | **Confirmed verbatim** |
| TigerBeetle: `timeout` zero = no timeout | [transfer ref](https://docs.tigerbeetle.com/reference/transfer/) | **Confirmed verbatim** |
| TigerBeetle: `ledger` partitions accounts; must match on both sides | same | **Confirmed — cross-currency transfers impossible.** C7 stands and is now a Phase-0 issue |
| TigerBeetle: `id_already_failed` is permanent | [create_transfers](https://docs.tigerbeetle.com/reference/requests/create_transfers/) | **Confirmed verbatim** — *"will always fail upon retry, even if the underlying issue is resolved"*. C5 stands |
| SOFORT discontinued 31 March 2025 | [Stripe](https://docs.stripe.com/payments/sofort) | **Confirmed verbatim.** C10 stands |
| Giropay: no onboarding or transactions after 30 June 2024 | [Stripe](https://docs.stripe.com/payments/giropay) | **Confirmed verbatim.** C11 stands |
| AMLR €2,000 gambling threshold, aggregated | [EUR-Lex 32024R1624](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32024R1624) | **Confirmed verbatim** |
| UK Remote Gaming Duty 40% from 1 April 2026 | [GOV.UK](https://www.gov.uk/guidance/general-betting-duty-pool-betting-duty-and-remote-gaming-duty) | **Confirmed verbatim** |

### Corrected as a result ⚠️

| Finding | Detail |
|---|---|
| **UK betting-exchange duty was missing entirely** | HMRC states **"15% of the commission charges charged by betting exchanges to users who are UK people"** — a *different tax base* (commission, not GGR) at a *different rate* (15%, not 40%). No secondary source surfaced this and no agent found it. It materially changes the UK business case: casino carries 40% of GGR, the exchange carries 15% of commission. **§10.4 corrected.** |
| **§10.4 was tagged [V] on trade-press evidence** | Downgraded per-row. Only the UK rows are now verified |

### Still unverified ❌ — flagged in the documents, not silently kept

| Claim | Why not verified |
|---|---|
| UK remote betting duty rising to 25% in April 2027 | HMRC's current guidance states **15%** and does not mention a 2027 change. Commons Library briefing returned **HTTP 403**. **Model on 15%; treat 25% as risk** |
| Sweden 22% of GGR | Skatteverket not reached; session WebSearch budget exhausted (200/200) |
| Germany 5.3% of turnover | German primary law not reached |
| AMLR application date of 10 July 2027 | EUR-Lex fetch confirmed the threshold and obliged-entity status but did **not** surface the application date |
| German tiered slot stake (€1/€3/€5, operator opt-in) | GGL's own site does not expose the figures to fetch; corroborated by trade press only |
| Self-exclusion register names and check-point obligations | Not reached |
| Betfair ladder range and increments | Not reached |
| `exchange-core` licence | Not reached — `PRD.md` §13.2 already says "verify before adopting" |

---

## 9. WHAT THE REVIEW COULD NOT VERIFY

The compliance-docs agent exhausted its WebSearch budget (200/200) and reported honestly:

> *"UKGC SRCP 3.5.3 (return of funds on self-exclusion), MGA Player Protection Directive, LUGAS
> cross-operator cap mechanics, the German tiered slot-stake rule of 1 July 2026, and every rate in
> PRD §10.4 are UNVERIFIED here. All findings below are derived from the documents themselves and
> are stated as document defects, not as regulatory rulings."*

Also unreachable: `gamblingcommission.gov.uk` LCCP pages return a table-of-contents shell to
WebFetch; `gluecksspiel-behoerde.de` LUGAS/Spielerschutz paths 404. Betfair primary sources were
unreachable, so the exchange-mechanics claims dependent on them are unverified.

**Consequence: every duty rate in §10.4 remains unverified by this review.** They were verified by me
earlier in the session against industry sources, not against HMRC/Skatteverket primary text.

---

## 10. CONTEXT ASSESSMENT — how much to trust each finding

**Trust directly (mechanical, context-free, primary-sourced).** The TigerBeetle semantics (C1–C8) are
quoted verbatim from official docs and are checkable in minutes. The dead payment rails (C10, C11)
are stated by Stripe. The AMLR handover (C9) is EUR-Lex. All cross-reference and numbering collisions
(C13, C14, H33–H35) are `grep`-verifiable. The platform fingerprinting (§1) is SHA-256 hashes anyone
can reproduce. **Narrow context is an advantage here** — these are exactly the checks a fresh reader
does better than the author.

**Needs my verification before acting.**
- The German stake rule (§8 above) — agents disagree.
- **H52 — "the agent hierarchy is not structurally unlicensable, Sweden registers gambling agents by
  statute."** I am sceptical. Sweden's *spelombud* are retail ticket agents for licensed operators;
  that is not the same as a credit-extending agent holding player funds and settling in cash
  off-platform. The agent may have found a real statutory concept and misapplied it. **Do not weaken
  D1 on this finding without checking.**
- H49 (German cash-out prohibition) — plausible and important, single-sourced.
- C23's specific German cricket-market PDF — verify the URL resolves and check its date.

**Agent lacked context (discount accordingly).**
- Findings framing deliberate deferrals as gaps — tote (Phase 3 by decision), native apps, Kafka.
  These are named as deliberate in `ARCHITECTURE.md` §10 and are not oversights.
- H37's "PRD says build nothing, PLAN says start now" reads as a contradiction but is the deliberate
  resolution we reached: Phase 0 is jurisdiction-independent *by design*. **However, H32's claim that
  this is false in three concrete ways is a separate and substantive challenge to that reasoning —
  it needs answering on the merits, not dismissing.**
- Several "unscheduled" findings (H41, H42) are things I added to §11.11 late in the session
  explicitly flagged as unscheduled. The agent correctly identifies them; it just doesn't know they
  were already known.

**Self-inflicted during this session** — C13 (dangling D20), C14 (spread split), H51 (D1 vs §4.4
credit claim). All three are edits I made without completing the corresponding decision-log entries.

---

## 11. DISPOSITION — what has been applied

> This section previously read *"No source document has been modified."* That was accurate when
> this document was compiled and stopped being true once the corrections were applied on
> 2026-08-04. Updated rather than left standing.

### Applied ✅

- **All factual corrections.** Sofort and Giropay removed; AMLD→AMLR handover; §2 platform-identity
  claim corrected via **D22**; §5.3's uncited fancy-market prohibition withdrawn via **D21**; §4.4's
  credit ground corrected via **D20**; §10.3's German stake rule corrected and re-tagged; §10.4
  rebuilt against HMRC primary guidance.
- **All ID collisions and dangling references.** `WD`/`WM` prefixes, `D19` created to close the
  dangling `D20` reference, legends added to PLAN, MILESTONES and STATE.
- **Both wrong CLAUDE.md rules.** §3.1 split into exchange tick-index and sportsbook scaled-integer
  prices; §5 rule 2 split into customer exposure and operator liability (new rule 11).
- **Cross-document contradictions.** Spread gate aligned across PRD/PLAN/MILESTONES; M1's exit gate
  now stated identically in PLAN and MILESTONES; ARCHITECTURE's money-seam diagram routed through
  `ledger/` and `repo`; §9's failure table cross-referenced to §12 where it was contradicted.
- **Milestone propagation.** `A2.2` qualified and `A2.4`/`A2.5` added; `O1` renamed; `A4.1` gains
  the UNIQUE constraint; M1's proof invariant rescoped; M8's proof no longer requires M10's work;
  M9's dependencies stated.

### Held for sign-off, not applied ⏸

The eight architectural decisions are recorded in `docs/ARCHITECTURE.md` §12 with recommendations
and status. Three M1 tasks (`A3.2`, `A3.3`, `A4.5`) carry ⚠️ markers and **must not be implemented
as written**.

### Deferred by decision 📋

Everything in finding **#5** (PII placement), plus C12, C20, C21 and the §11.11 obligations, move to
a later combined compliance cycle covering GDPR, SOC2 and related. One carve-out survives because it
is unretrofittable: `C4.2`'s audit wrapper must log **opaque user IDs, never names or emails** —
immudb is cryptographically append-only.

### Still open ❓

1. **H52** — "the agent hierarchy is not structurally unlicensable, Sweden registers gambling agents
   by statute." Unverified and doubted: Swedish *spelombud* are retail ticket agents, not
   credit-extending agents holding player funds. **D1 has not been weakened on this basis.**
2. The unverified rates and rules in **§8b** — Sweden, Germany, the AMLR application date, the
   German tiered stake. Needs a session with search budget.
3. **C22's design specification.** The parity agent produced implementable values from public theme
   tokens. Not yet written into the documents — see `PRD.md` §11.0, which does not exist yet.
