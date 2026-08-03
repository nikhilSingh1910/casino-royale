# Product Requirements Document
## Betting Exchange, Sportsbook & Casino Platform — EU/EEA Licensed Build

| | |
|---|---|
| **Version** | 0.2 — Expanded. Draft for client review |
| **Date** | 2026-08-03 |
| **Status** | Blocked on §16 Q1 (target jurisdiction) |
| **Owner** | Product |
| **Parts** | **I** — Reference platform teardown · **II** — Target product spec · **III** — Delivery |

---

### Evidence legend

Claims in Part I are tagged for reliability. The client should treat them accordingly.

| Tag | Meaning |
|---|---|
| **[V]** | Verified against public sources. Part I sources are listed in §18; **Part II claims cite inline**, since §18 is scoped to the reference-platform teardown only |
| **[D]** | Domain-standard for this platform class — high confidence, not individually verified per-site |
| **[I]** | Inferred from the supplied material or category norms — **confirm before relying on it** |

**Scope limit, stated plainly:** this teardown was produced without authenticating to the reference sites. No credentialed session was opened against any of the seven URLs supplied. Part I therefore describes the *platform family* with high confidence and does **not** claim per-site feature differentiation. §5 explains why that limitation costs less than it appears to.

---

# PART I — REFERENCE PLATFORM TEARDOWN

## 1. What was supplied

Eight URLs with account credentials, distributed via a broadcast promotional message:

| # | Domain | Stated predecessor | Min. deposit | Unit |
|---|---|---|---|---|
| 1 | coexch777.co | probet777.co | ₹100 | 1 point = ₹1 |
| 2 | coexch9.co | probetx.in | ₹100 | 1 point = ₹1 |
| 3 | Kingexch365.com | — | ₹100 | 1 point = ₹1 |
| 4 | thelotus247.com | — | ₹100 | 1 point = ₹1 |
| 5 | tiger365.pro | — | ₹100 | 1 point = ₹1 |
| 6 | Diam247x.com | — | ₹100 | 1 point = ₹1 |
| 7 | Abexch365.com | — | ₹100 | 1 point = ₹1 |
| 8 | client.top5050.in | — | — | — |

The message brands the set as one operation ("SAI EXCHANGE"), advertises cricket + "200+ casino" + horse racing, and promises 24/7 deposit.

## 2. Core finding: at least three different white-label products, not one

> **Corrected 2026-08-04 by direct fingerprinting.** An earlier version of this section claimed the
> seven domains were "skins of a common white-label platform" and tagged it **[V]**. That was
> **false** — it was inference from commercial similarity, not verification. Direct inspection of
> the public landing pages found at least five mutually distinct application stacks. The corrected
> finding below is stronger, not weaker.

**They are deployments of at least three distinct white-label products, at least one of which is
provably multi-tenant across four or more brands. [V]**

### 2.0 What direct fingerprinting shows

| Domain | Stack | Evidence |
|---|---|---|
| kingexch365.com | nginx + Angular 17.3.1 | Public landing HTML + bundle |
| diam247x.com | S3/CloudFront + Vue + jQuery + socket.io + protobuf | API namespace `/api/client/*` |
| tiger365.pro | Laravel/PHP | Laravel-encrypted `XSRF-TOKEN`, `ex_session` cookies |
| thelotus247.com | 301 → lotusbook.cricket, Next.js | `x-powered-by: Next.js` |
| coexch777.co, coexch9.co | CNAME into a numbered Cloudflare tenant family | DNS |
| abexch365.com | offline | — |

API namespaces are irreconcilable: one family uses `/api/exchange/*` + `/app/exchange/*`, another
uses `/api/client/*`.

**The white-label finding survives in a much stronger form.** `main.f3c5a4b8eb7bccdf.js` is
**byte-identical — SHA-256 `7c847a6b…67af1a` — across kingexch365.com, queenx247.com and
t20worldexch.com**, served from three separate AWS ap-south-1 addresses, with the landing HTML
diffing empty between two of them. The bundle carries `siteKey:"2"`, fetches its theme at runtime
from `/api/exchange/theme/getThemeConfig`, exposes **885 CSS custom properties**, and contains
hardcoded per-brand conditionals naming sibling tenants:

```js
checkToAddSignup(){ ...["https://queenx247.com"].includes(a)&&this.customerHelp() }
checkDomain(){ ...return!!["https://t20worldexch.com"].includes(Dt) }
```

That is a parameterised multi-tenant product with a leaked customer list — and every tenant ships
its competitors' feature flags.

**Consequence for §2.1: unchanged and reinforced.** There is no single stack to acquire, and the
one that is verifiably multi-tenant is architected around the model §4 rejects.

### 2.1 Supporting commercial evidence

The following still holds and sits in the supplied message itself. Note it evidences a **common
commercial operation**, not common software — that distinction is what the earlier draft got wrong:

1. **Self-declared domain rotation.** Two entries explicitly announce themselves as the "Updated Version Of" a prior domain (`probet777.co` → `coexch777.co`; `probetx.in` → `coexch9.co`). Operators publishing their own migration path is the signature of blocking-evasion, not rebranding. **[V — from the source message]**
2. **Identical commercial parameters across all seven.** Same ₹100 minimum, same "1 point @ 1 rupee" accounting abstraction, same 24/7 deposit promise, one support channel. Independent operators do not converge on identical terms. **[V]**
3. **Uniform demo-credential pattern.** The supplied demo accounts use sequential usernames drawn from a single shared namespace (one common prefix, incrementing numeric suffix, across all seven sites), together with a small set of **three** reused default passwords spread across the seven accounts. That is one provisioning convention, not seven independent operators. **[V]**
   > **Values redacted 2026-08-04.** The actual usernames and passwords were present in an earlier draft and were removed before this repository was published. They are live credentials on real-money platforms; the evidential point — shared namespace, reused defaults — does not require reproducing them. Do not re-add them.
4. **A commodity clone industry exists and is openly priced.** Multiple vendors sell "Diamond Exchange clone" / "white label betting exchange" packages with Betfair API integration — including a Fiverr listing at **$1,500**. Named vendors include Innosoft Group, BR Softech, Bettoblock, PieGaming and Play Profits. **[V]**
5. **The brand names are the clone industry's own catalogue.** "Diamond Exchange", "Lotus", "Tiger Exchange" are sold as named white-label templates. Items 4, 5 and 6 above (`thelotus247`, `tiger365`, `Diam247x`) map directly onto that catalogue. **[V]**

### 2.1 What this means for the client

The instruction "find out what each site supports" has an unexpected answer: **there is one feature set to document, not eight.** Site-by-site exploration would have produced seven near-identical inventories differing in logo, colour scheme and casino-provider mix. The engineering-relevant artefact is the platform-family specification below.

**Corollary — do not buy this stack.** If anyone proposes accelerating the European build by licensing one of these white-labels, the answer is no. Its architecture is *built around* the credit-agent model (§4), has no KYC/AML/RG layer to speak of (§6), and could not pass an MGA or UKGC platform audit without being rewritten to its foundations. It is cheaper to build clean than to remediate.

## 3. Reference stack (inferred architecture)

| Layer | Almost certainly | Confidence |
|---|---|---|
| Exchange prices & liquidity | **Betfair Exchange API**, usually via third-party resellers rather than direct licensing | **[V]** industry-standard; resellers openly advertise |
| Fixed-odds / "premium" markets | Secondary feed (Betradar/Sportradar-derived) or operator-priced | **[D]** |
| Live casino | Aggregated third-party — Evolution, Ezugi, Pragmatic Play, plus India-facing studios (Supernowa, Vivo, TVBet) | **[V]** for Evolution/Pragmatic/NetEnt; **[D]** for the rest |
| "Our Casino" / in-house games | Low-cost proprietary card games, operator-controlled RTP | **[I]** — a known pattern; unverified here |
| Crash / instant | Aviator (Spribe) and clones | **[D]** |
| Live TV | Low-latency stream embedded beside the bet slip | **[D]** |
| Admin/agent panel | Proprietary to the white-label — the actual product being sold | **[V]** |
| Payments | **No integrated PSP.** Funds move agent↔player off-platform (UPI/bank/cash); platform only mints and burns credit | **[V]** — panel vendors advertise exactly this |

The single most important structural fact: **the reference platforms are not payment systems.** They are credit-ledger systems with an offline settlement layer. This is the root of nearly every incompatibility in §4.

## 4. The agent hierarchy — the actual product

This is what the white-label vendors sell, and what the demo IDs sit at the bottom of. Understanding it is essential because it is the part the client **cannot** replicate.

### 4.1 Tier structure [V for the structure · conflicting sources on the abbreviations]

Vendors advertise these tiers by name, "available on rental & sharing base". **The descending
credit-reseller structure is well corroborated across many independent vendor sites. The expansion
of the abbreviations is not** — two readings are live in the sources:

| Abbreviation | Reading A (majority) | Reading B |
|---|---|---|
| DL | Direct Line | Dealer |
| MDL | Master Dealer Line | Mini Dealer |
| SMDL | Sub Master Dealer Line | Super Mini Dealer |

Both describe the same descending panel hierarchy beneath Admin. **Do not present either expansion
as definitive**; the structure is the finding, the naming is not.

```
Super Admin / White-label owner
    └── Admin  ("Super Distributor")
          └── Sub-Admin
                └── Super Master   (SMDL — Sub Master Dealer Line)
                      └── Master   (MDL — Master Dealer Line)
                            └── Agent / Dealer  (DL — Direct Line)
                                  └── Client   ← the supplied demo IDs
```

### 4.2 How money actually moves [V/D]

1. Player contacts an agent over WhatsApp/Telegram. Agent creates a client ID and sets a password. **No identity verification. No age check.**
2. Player transfers cash/UPI to the agent **off-platform**.
3. Agent credits "chips"/"coins" to the ID from the panel — real-time, one click. **[V]** Vendors advertise instant coin add/remove and 15–30 minute withdrawal.
4. Player wagers. Wins and losses adjust the chip balance.
5. On a settlement cycle (typically weekly), net position between player and agent is settled **in cash, off-platform**. The same then happens up every tier of the chain. *(The weekly net-cash-settlement mechanism is well documented. The colloquial Hindi label "lena-dena" was used in an earlier draft but could not be verified verbatim in any fetched source, so it has been removed rather than presented as terminology.)*

The platform never touches player money. It is a scorekeeping system for an offline cash network.

### 4.3 Panel capabilities per tier [D]

Each tier's panel exposes, over its downline only:

- **Credit control** — issue/withdraw chips; set credit reference; per-user exposure ceiling
- **Partnership %** — each tier keeps a configured share of downline losses; the remainder flows upward. Configured at ID creation and typically immutable thereafter
- **Rolling commission** — turnover-based commission on selected market types (commonly the bookmaker and session markets), independent of win/loss
- **Live risk view ("Market Analysis")** — the operator's own book position per market/runner in real time, showing worst-case liability across outcomes
- **User controls** — bet lock (view but not wager), user lock (no login), suspend, password reset
- **Limit configuration** — min/max stake per market type, per-market exposure caps, session/fancy-specific limits
- **Bet management** — void individual bets, rollback a settled market, resettle
- **Reporting** — client P&L, downline P&L, account statement, bet history, settlement ledger

### 4.4 Why this cannot be ported to Europe

The credit-agent model is not a feature that needs adapting. It is **structurally unlicensable**, on at least five independent grounds:

| Ground | Detail |
|---|---|
| **Credit funding** | An unlicensed third party funding play on tick has no licensed equivalent. Note the precise UK position: LCCP condition 6.1.2 bans **credit cards** as a gambling payment method (from 14 April 2020) — that is a payment-method rule, not a blanket ban on credit betting, and the two are frequently conflated. The agent model fails principally on the four grounds below; the card ban is evidence of regulatory direction, not the operative prohibition **[V]** |
| **Unlicensed money transmission** | Agents receive and disburse customer funds, off-book, across borders — a regulated activity they do not hold permission for |
| **AML failure by construction** | Cash settlement with no customer due diligence is the textbook laundering channel the EU AML framework exists to close — see §10.2 for the AMLD→AMLR handover |
| **Self-exclusion defeat** | Agent-issued, transferable, shareable IDs make per-person exclusion unenforceable |
| **No player-funds segregation** | There are no player funds on-platform to segregate |

**Replacement (specified in §11.9):** direct-to-consumer registration, operator-held segregated funds, and affiliates on revenue-share who never touch player money and never issue accounts.

## 5. Player-facing functional inventory

The complete surface of this platform family. Everything below is **[V]** or **[D]** unless marked otherwise.

### 5.1 Navigation & sports coverage

Cricket first and dominant; then football, tennis, horse racing, greyhounds, kabaddi, basketball; occasionally politics and esports. Standard layout: left sports tree, centre market list, right bet slip, live TV + scorecard panel where available.

### 5.2 Market taxonomy — cricket

The distinguishing depth of this platform class. Presented as tabs on the event page:

| Tab | Mechanic | Priced by | Notes |
|---|---|---|---|
| **Match Odds** | True exchange — back/lay, order book, partial fills | Betfair-derived liquidity | The genuine exchange product |
| **Bookmaker** | Operator-priced fixed odds, back/lay presented but operator is counterparty | Operator | Higher margin. Where much of the real revenue sits |
| **Fancy / Session** | Yes/No propositions on sub-events, ball-by-ball repricing | Operator | See §5.3 — the highest-risk category |
| **Toss** | Binary on coin toss | Operator | Pure chance; trivially manipulable |
| **Premium / Sportsbook** | Broad fixed-odds market set (totals, player props, method) | Secondary feed | Resembles a conventional sportsbook |
| **Outright / Winner** | Tournament-level | Exchange or feed | — |

### 5.3 Fancy / session market taxonomy [V]

Priced as a two-sided line with separate Yes/No prices, repricing continuously in-running:

- **Lambi** — full-innings total for a side. Opens at innings start, moves on every ball; a boundary or wicket shifts the line sharply. **[V]**
- **Khado** — the innings cut into blocks, typically 6 overs ("1st 6 Overs Runs 45–50", "Overs 7–12: 35–40"). Settles immediately at block end. **[V]**
- **Odd/Even** — parity of a total. **[V]**
- Plus, standard across the category **[D]**: individual batsman runs, fall-of-wicket totals, over-by-over runs, total boundaries/sixes, method of dismissal, "only 1st over" runs, player-performance lines.

**Integrity assessment.** These markets settle on micro-events controllable by a single player — one bowler, one over, one delivery. That is the exact attack surface exploited in every major cricket spot-fixing case, and integrity bodies flag markets of this granularity.

> **Corrected 2026-08-04.** An earlier version of this section asserted that *"no amount of
> compliance tooling makes ball-level session markets licensable"* — **with no rule, no regulator
> and no citation anywhere in the document.** That blanket claim is not supportable and is
> withdrawn. **The real answer is per-jurisdiction, and it is checkable:**
>
> - **Germany operates a closed list.** §21(5) GlüStV requires each bet's *Art und Zuschnitt* to be
>   authorised in advance against a published list, and GGL publishes a cricket market list. In DE
>   the answer for any given market is therefore determinate — look it up — not a judgement call.
> - **Other jurisdictions do not operate closed lists**, and no rule was found making granular
>   cricket markets universally unlicensable across the EEA.
>
> **Both failure directions are live.** Dropping cricket from the business case on a prohibition
> that does not exist is as costly as shipping an over-runs market that breaches §21(1a) S.4 in
> Germany. Resolve per target market, and see `docs/DECISIONS.md` D21.

### 5.4 Bet slip & account mechanics [D]

- Back/lay entry with stake, computed profit and **liability** (lay liability = (odds − 1) × stake)
- Preset stake buttons; one-click betting toggle
- **Balance vs. Exposure** displayed separately — exposure is funds reserved against open positions
- Bet delay on in-play submission (seconds), mitigating courtsiding
- Market suspension on incidents (wicket/goal), blocking new matching
- My Bets / open positions / bet history / P&L statement / account statement
- Forced password change on first login (why broadcast demo IDs carry default passwords)
- Rules page; English and Hindi

### 5.5 Casino module [V]

The promo's "200+ CASINO" is consistent with published counts for this family (Tiger Exchange advertises 200+; Lotus365 advertises 550+).

| Category | Titles |
|---|---|
| **India-facing live card games** | Teen Patti (multiple variants), Andar Bahar, Dragon Tiger, Lucky 7, 32 Cards, 7 Up Down, Worli Matka, Bollywood Casino, Amar Akbar Anthony, Casino War |
| **International live dealer** | Roulette, Blackjack, Baccarat, Sic Bo, Crazy Time, game shows |
| **Slots / RNG** | Third-party studio content |
| **Crash / instant** | Aviator-type multiplier games |
| **Virtual sports** | Simulated racing/football |

Named studios in this segment: **Evolution, NetEnt, Pragmatic Play** **[V]**; Ezugi, Supernowa, Vivo, TVBet, JILI **[D]**.

Note the "Worli Matka" title — an online rendering of the satta-matka numbers racket. Its presence is a direct signal of the operating context.

### 5.6 What is conspicuously absent

The absences characterise the product as sharply as the features:

- ✗ Any KYC or age verification
- ✗ Any integrated payment processing
- ✗ Deposit / loss / session limits
- ✗ Reality checks, time-out, self-exclusion
- ✗ Source-of-funds checks, transaction monitoring, SAR capability
- ✗ Published RTP, lab certification, licence disclosure
- ✗ Meaningful terms, dispute process, or complaints route
- ✗ A stable domain

**Every single one of these is a launch blocker in Europe.** The gap between this platform and a licensable one is not a feature backlog — it is most of the system.

## 6. Why the reference platforms are built this way

Context, not a constraint on this project. It explains two design choices that would otherwise look arbitrary.

India's **Promotion and Regulation of Online Gaming Act, 2025** prohibits real-money online gaming nationwide — skill and chance alike. Enforcement to date: ~8,400 sites and apps blocked, ~4,900 of them since the Act commenced. Named categories include peer-to-peer betting exchanges and satta-matka networks. **[V]**

Two things follow that matter to this build:

1. **The domain rotation is explained.** "Updated Version Of probet777.co" is a migration notice for a blocked domain. Practically: any feature inventory taken from these sites is a snapshot of a moving target, and stable-domain requirements (§12) exist for licensing reasons anyway.
2. **Keep the clone vendors out of procurement.** The white-label vendors in §2 build for this segment. Engaging one — even for an unrelated component — creates a supplier relationship that surfaces during licensing due diligence. Easy to avoid; expensive to explain later.

Nothing here bears on a European operator serving European customers under a European licence. It bears only on what can be reused from the reference stack.

## 7. Reference platform → target product: disposition of every feature

The complete port decision. This table is the bridge between Parts I and II.

| Reference feature | Disposition | Where specified |
|---|---|---|
| Exchange match odds, back/lay, order book | ✅ **Adopt** — core differentiator | §11.3 |
| Bookmaker market (operator-priced) | ✅ **Adopt** as a conventional fixed-odds sportsbook | §11.4 |
| Premium / sportsbook markets | ✅ **Adopt** | §11.4 |
| Live casino & slots (aggregated) | ✅ **Adopt** — swap India-facing studios for EU-certified content | §11.5 |
| Crash / instant games | ✅ Adopt where certified | §11.5 |
| Horse racing | ⚠️ Adopt fixed-odds/exchange; **tote needs a separate licence** | §11.6 |
| Live TV + scorecard | ✅ Adopt (rights cost — budget it) | §11.4 |
| Exposure/liability display | ✅ **Adopt and improve** — best idea in the reference UX | §11.3 |
| Bet delay in-play | ✅ Adopt | §11.3 |
| Market suspend on incident | ✅ Adopt | §11.3 |
| Rolling commission on turnover | ⚠️ Adopt only as exchange commission on **net winnings** | §11.3 |
| Multi-tier agent hierarchy | ❌ **Reject** — unlicensable | §11.9 |
| Chip/credit issuance | ❌ **Reject** — replace with real PSP + segregated funds | §11.2 |
| Offline cash settlement | ❌ **Reject** | §11.2 |
| Agent-created accounts, no KYC | ❌ **Reject** | §11.1 |
| Shared/transferable IDs | ❌ **Reject** — one verified person per account | §11.1 |
| Fancy / session / ball-level markets | ❌ **Reject** — integrity-prohibited | §5.3, §11.4 |
| Toss market | ❌ Reject | §11.4 |
| "Points" instead of currency | ❌ Reject — display fiat always | §11.2 |
| Domain rotation | ❌ Reject — one whitelisted domain per market | §12 |
| Operator-controlled RTP in-house games | ❌ Reject — certified content only | §11.5 |
| — | ➕ **Add:** KYC/AML, RG suite, self-exclusion registers, segregated funds, audit log, regulatory reporting | §10, §11.7 |

**Read the balance of that table before scoping.** Roughly half the reference product ports. The rejected half is the half that made it cheap to run, and the added half is the half that makes it legal. Any budget extrapolated from the reference operation's economics will be wrong by a wide margin.

---

# PART II — TARGET PRODUCT SPECIFICATION

## 8. Executive summary

A real-money wagering platform combining three revenue engines behind one identity and one wallet:

1. **Betting exchange** — peer-to-peer back/lay, commission on net winnings, no book risk. The differentiator and retention hook.
2. **Fixed-odds sportsbook** — operator-priced, operator carries risk. The on-ramp for the majority who will never understand lay betting.
3. **Casino & live casino** — aggregated third-party content. Highest margin, lowest build cost; in practice it funds the exchange's liquidity problem.

**Phase 1 target:** one licensed market; sportsbook + casino live; exchange in closed beta behind a solved liquidity commitment.

## 9. Goals, non-goals, metrics

### 9.1 Goals
- **G1** Compliant, auditable, licensed launch in one market.
- **G2** Exchange liquidity sufficient to be usable — see §9.3 for the staged targets. <2% spread is a *maturity* target, not a launch gate.
- **G3** Compliance evidence (RG interventions, AML alerts, exclusion enforcement) producible on demand with zero engineering involvement.
- **G4** One wallet across all three engines, on a correct double-entry ledger.

### 9.2 Non-goals (Phase 1)
Multi-jurisdiction launch · proprietary game development · own pricing/odds model · crypto rails · native apps (PWA first) · tote/pari-mutuel · anything resembling §4.

### 9.3 Metrics

| Metric | Target |
|---|---|
| Automated KYC pass rate (no manual review) | > 85% |
| Registration → first deposit | > 30% |
| Exchange matched-order rate | > 70% |
| Exchange spread — **beta exit** | < 5% on the single seeded market at kick-off |
| Exchange spread — **maturity** | < 2% on top-3 football markets at kick-off |
| Casino GGR margin | 3–5% of turnover |
| Exchange commission yield | 2–5% of net winnings |
| Median withdrawal time (post-KYC) | < 4 h |
| P99 exchange match latency | < 150 ms |
| RG intervention → session-end rate | Tracked and reported; **no target** (compliance metric, not growth) |

## 10. Regulatory foundation

There is no single "European gambling licence." Regulation is **per-member-state**, and the licence chosen determines product scope, payments, market types, marketing and data residency. **This decision precedes engineering.**

### 10.1 Licensing models

| Model | Examples | Notes |
|---|---|---|
| National, locally regulated | UK (UKGC), SE (Spelinspektionen), DK (Spillemyndigheden), NL (KSA), DE (GGL), ES (DGOJ), IT (ADM) | Licence per market. Strictest. Mandatory national self-exclusion register integration |
| B2C base licence | Malta (MGA), Isle of Man, Gibraltar | Common base. **Does not authorise** the locally-regulated markets above |
| Curaçao / offshore | — | **Out of scope.** Not "legal in Europe"; fails EEA bank and PSP onboarding |

### 10.2 Launch blockers — apply in substantially every licensed EU market

- **KYC before withdrawal**; before *play* in DE, NL, SE. Age 18+ (21+ some markets)
- **EU AML framework — note the handover, this platform likely launches under the new one. [V in part — see the split below]**
  Directive (EU) 2015/849 (AMLD4 as amended by AMLD5) is in force today, but it is repealed by
  Directive (EU) 2024/1640 and replaced for substantive obligations by
  **[Regulation (EU) 2024/1624 (AMLR)](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32024R1624)**,
  directly applicable from **10 July 2027**. AMLR names providers of gambling services as obliged
  entities and sets a **€2,000** occasional-transaction threshold, aggregated across smaller
  transactions. Supervision moves to **AMLA** (Frankfurt), direct supervision from 2028.
  Given §14's 4–12 month licence timeline, **build CDD, EDD and monitoring to AMLR, not AMLD5.**
  Obligations themselves are broadly continuous: CDD, EDD over thresholds, source of funds,
  transaction monitoring, SAR to the national FIU, 5-year retention.
  Stop writing "AMLD6" — the label is ambiguous between Directive (EU) 2018/1673 and the 2024 package.

  > **Evidence split — do not treat this bullet as uniformly verified.**
  > **Verified verbatim from EUR-Lex:** the €2,000 threshold *"is met regardless of whether the
  > customer carries out a single transaction of at least that amount or several smaller
  > transactions which add up to that amount"*, and that providers of gambling services are obliged
  > entities under the Regulation.
  > **Not verified:** the **10 July 2027** application date, the **2028** AMLA supervision date, and
  > the repeal mechanism via Directive (EU) 2024/1640. The EUR-Lex fetch did not surface the
  > application-date clause. **Confirm the commencement date before scheduling compliance work
  > against it** — the whole "build to AMLR not AMLD5" conclusion depends on it.
- **National self-exclusion registers** — GAMSTOP (UK), Spelpaus (SE), CRUKS (NL), OASIS (DE), ROFUS (DK). Checked at login, deposit **and** wager
- **RG toolset** — deposit/loss/session limits, reality checks, time-out, self-exclusion. Several markets require limits at registration and cooling-off before increases take effect
- **Credit funding restrictions** — UK bans credit *cards* as a payment method (LCCP 6.1.2). Verify the precise rule per market; "no credit betting" is a common over-simplification
- **Player funds segregation** with published protection rating — see §11.11
- **Certified RNG + published RTP** — GLI, eCOGRA or iTech Labs
- **Regulatory reporting feeds** — DK SAFE, IT ADM, DE LUGAS
- **GDPR** — lawful basis, DSAR, retention schedule, DPIA (wagering data is behavioural profiling), residency per licence
- **Marketing restrictions** — IT near-total advertising ban; DE/NL heavily restricted; SE caps bonuses to first deposit only

### 10.3 Germany as a separate variant

If DE is in scope, GlüStV 2021 changes the architecture, not the copy: **5-second minimum spin interval**, no live casino under the federal sportsbook licence, in-play restricted to next-goal/final-result, and a **cross-operator €1,000 monthly deposit cap** aggregated in real time through central LUGAS. Scope DE as a product variant, never as a localisation.

**The slot stake limit is now tiered, and it is operator opt-in. [corroborated — GGL primary text not reachable]** As of **July 2026** the former flat €1/spin was replaced by a tiered system:

| Tier | Condition |
|---|---|
| **€1** | **Baseline for every player.** Remains the legal default, and the only limit available to operators outside the tiered scheme |
| **€3** | Players aged **21+** |
| **€5** | Players showing **no problematic-gambling indicators over the preceding 90 days** |

**Two conditions an earlier draft of this section got wrong and that change the engineering:**

1. **€1 is the universal baseline, not an under-21 tier.** Every player starts there.
2. **The higher tiers require GGL approval and are opt-in per operator**, and an approved operator
   must carry out *"special monitoring to track player behaviour both before and after the
   increase"* ([iGaming Business](https://igamingbusiness.com/legal-compliance/regulation/germany-raises-online-slot-stake-limits-operators-to-track-player-behaviours/)).

So the config model must express four dimensions, not one constant: a baseline, an
**operator-level approval flag**, an age tier, and a rolling 90-day behavioural qualification —
plus the monitoring obligation that comes with opting in. That makes it a far better stress test
for §13's jurisdiction config than the flat cap, and `docs/MILESTONES.md` M3's proof must be
restated against it.

> **Evidence status.** GGL's own site did not expose the figures to direct fetch and the session's
> search budget was exhausted, so this is corroborated by trade press rather than verified against
> the regulator's published text. **Re-verify against GGL primary sources before building to it.**

**DE rules are actively moving.** GGL expanded LUGAS with Dataport in July 2026 and the Interstate Treaty is under review. Anything encoded here needs re-checking at implementation time, not assumed stable.

This matters more than the numbers suggest. A limit keyed on *age* **and** a *rolling behavioural qualification* is a far harder thing to express as configuration than a constant — which makes it the best available stress test for the §13 jurisdiction config model (see `docs/MILESTONES.md` M3). If the config layer can express this, it can express anything Europe currently has.

**DE rules are actively moving.** GGL expanded LUGAS with Dataport in July 2026 and the Interstate Treaty is under review. Anything encoded here needs re-checking at implementation time, not assumed stable.

### 10.4 Gaming duty — verify before any financial modelling

Duty is the single largest operating cost line. **Each row below carries its own evidence tag — do not treat the table as uniformly verified.**

### UK — verified against HMRC primary guidance [V]

Source: [GOV.UK — General Betting Duty, Pool Betting Duty and Remote Gaming Duty](https://www.gov.uk/guidance/general-betting-duty-pool-betting-duty-and-remote-gaming-duty), all quotes verbatim.

| Product | Rate | Charged on |
|---|---|---|
| **Casino / gaming (RGD)** | *"15% before 1 April 2019"* → *"21% from 1 April 2019"* → **"40% on or after 1 April 2026"** | Profits (stakes received less winnings paid) |
| **Sportsbook — fixed odds (GBD)** | *"15% for fixed odds and totalisator bets"* | Profits |
| **Betting exchange (GBD)** | **"15% of the commission charges charged by betting exchanges to users who are UK people"** | **Commission revenue** — a different base entirely |
| Financial spread bets | *"3%"* | Profits |
| Other spread bets | *"10%"* | Profits |
| Pool Betting Duty | *"15%"* | Profits |

> **The exchange row was missing from every earlier draft of this document, and it materially changes the UK business case.** A betting exchange is taxed at **15% of its commission**, not 40% of GGR — the three engines are taxed on three different bases at two different rates. Casino carries 40%; the exchange carries 15% of a much smaller number. Anyone modelling this platform as one blended rate will be wrong in both directions.

### Unverified — flagged rather than dropped

| Market | Claim | Status |
|---|---|---|
| **UK — remote betting duty rising to 25% in April 2027** | From trade press reporting Budget 2025 | **UNVERIFIED.** HMRC's current guidance states 15% and does not mention a 2027 change. The Commons Library briefing returned HTTP 403. **Model on 15% and treat 25% as a risk, not a fact** |
| **Sweden — 22% of GGR, raised from 18% in July 2024** | From trade press | **UNVERIFIED** against Skatteverket. Session search budget exhausted |
| **Germany — 5.3% of turnover** | From trade press | **UNVERIFIED** against German primary law |

> **Method note.** An earlier draft presented this entire table as **[V]** on the strength of trade-press summaries. That was wrong — a search-result summary is not verification, and `CLAUDE.md` §1 exists to prevent exactly this. Verification against HMRC confirmed the 40% figure, corrected the framing, and **surfaced the exchange-commission row that no secondary source had mentioned.** The unverified rows above stay in the document because deleting them would lose the signal; they are tagged so nobody plans around them.

> **Structural warning that survives verification.** If the German 5.3% figure holds, note it is **of turnover, not GGR**. On a low-margin sportsbook a turnover tax can exceed gross margin entirely. Model it as turnover; never convert it to a GGR-equivalent.

**Before any financial modelling:** verify every rate here against the national tax authority's own publication for the current tax year, and re-verify the UK 2027 position.

## 11. Functional specification

### 11.1 Identity & account

- Registration by email/phone; **one verified natural person per account**; jurisdiction from verified residence, not IP
- Tiers: **T0** registered (no play in DE/NL/SE) → **T1** verified (play + deposit) → **T2** enhanced (raised limits, SoF evidence)
- Age verification 18+, hard block before any real-money action
- Self-exclusion register check at registration, login, deposit, wager
- Geolocation + geo-blocking to licensed territory; VPN/proxy detection
- Multi-accounting detection: device fingerprint, IP, payment instrument, behavioural
- States: `ACTIVE` · `PENDING_VERIFICATION` · `LIMITED` · `SELF_EXCLUDED` · `COOLING_OFF` · `SUSPENDED` · `CLOSED`

> **Self-exclusion is irreversible for its stated term. No support override path may exist in code.** Not a policy — an architectural constraint. Build it so the capability is absent.

### 11.2 Wallet, payments & ledger

- **Double-entry ledger is the single source of truth.** Every balance change is a balanced journal entry. No mutable balance column holds authority. Non-negotiable for audit.
- Every entry is immutable, append-only and balanced, carries an idempotency key, and is traceable to the domain event that caused it. **Corrections are new compensating entries; never in-place edits.**
- **The physical schema is deliberately not specified here.** `docs/DECISIONS.md` D5 selects TigerBeetle, whose data model is fixed (typed accounts and transfers, currency separated by ledger, limited metadata fields) and does **not** accept arbitrary columns. An earlier draft of this section specified a relational entry shape with `reference_type` / `currency` columns that TigerBeetle cannot express — see `docs/DECISIONS.md` **D19** for the spike that must resolve this before commitment.
- Sub-balances: withdrawable cash · bonus funds · reserved exposure
- Deposits: cards (MCC 7995), open banking (Trustly, Tink), local rails — iDEAL (NL), Swish (SE), MB Way (PT). **Multi-PSP orchestration with routing and failover from day one**
  > **Sofort and Giropay were removed on 2026-08-04 — both are defunct. [V]** SOFORT was
  > discontinued **31 March 2025**; giropay stopped onboarding and processing after **30 June 2024**
  > and the scheme wound up at end-2024 ([Stripe](https://docs.stripe.com/payments/sofort),
  > [Stripe](https://docs.stripe.com/payments/giropay)). For a German bank-transfer flow consider
  > Klarna pay-in-full, SEPA Instant, or Wero. **Two named rails dying inside twelve months is the
  > strongest argument for D7 (Hyperswitch): treat every rail as a replaceable adapter with a
  > documented decommission path, and re-verify the whole list at implementation time.**
  > Gambling acceptance for any rail is an acquirer/scheme policy decision, not a technical one.
- **No credit.** Wagers only against settled deposited funds
- Withdrawals: return-to-source where required; configurable manual-review threshold; SLA-tracked
- Voids restore stake atomically; resettlements generate compensating entries
- **Daily three-way reconciliation** — PSP statements ↔ ledger ↔ game-provider transaction logs, with break reporting
- **Fiat displayed at all times.** No points, chips, coins or unit abstraction anywhere in the UI

### 11.3 Betting exchange

Users back or lay an outcome; orders match peer-to-peer; operator takes commission on **net winnings per market**, never on stake.

**Matching**
- Order book per market runner, **price-time priority**
- Standard exchange ladder (1.01–1000, variable increments)
- **Partial fills** — €500 @ 2.10 may fill €120 now, remainder resting. Matched vs. unmatched must be unambiguous in the UI
- Order types: limit (default), keep-in-play, cancel-on-in-play, fill-or-kill

**Risk & funds**
- **Liability reserved at submission, not settlement.** Lay liability = (odds − 1) × stake
- **Exposure engine** — net position per user per market, worst-case P&L across every runner. The most-used screen for serious users; correctness and latency both matter
- Commission shown pre-bet, never discovered at settlement. Configurable per market and per user tier

**Lifecycle**

```
OPEN → SUSPENDED ⇄ IN_PLAY → CLOSED → SETTLED | VOIDED
```

Bet: `SUBMITTED → VALIDATED → RESTING → PARTIALLY_MATCHED → MATCHED → SETTLED | VOIDED`, with `CANCELLED` reachable only from `RESTING` / `PARTIALLY_MATCHED`.

- Suspension is instantaneous, cancels nothing, blocks new matching only
- **In-play bet delay** (1–8 s by sport) on all submissions — anti-courtsiding
- Settlement from an authoritative result feed. Manual override requires **dual authorisation** and a permanent audit record
- **Trader API** — REST for state, WebSocket for prices, keyed and rate-limited. This is how liquidity providers are acquired; it is not a nice-to-have

> **Liquidity is the existential risk.** An empty order book is worthless and users do not return after seeing one. Options: market-making agreements with proprietary trading firms; seeded internal liquidity (**must be disclosed; restricted in several jurisdictions**); or sportsbook-backed unmatched orders. **Solve this commercially before building the module.** It is a Phase-2 entry gate, not an engineering problem.

### 11.4 Fixed-odds sportsbook

- Licensed feed (Sportradar, Betgenius) for pricing, fixtures, live data, results, settlement
- Pre-match and in-play; **market types constrained by jurisdiction** — no session/fancy/ball-level markets (§5.3), no toss
- Bet types: single, multiple/accumulator, system; cash-out pre-match and in-play (high demand, non-trivial pricing)
- Placement is two-phase against the feed: price validation → accept/reject on movement within configurable tolerance
- Lifecycle: `SUBMITTED → PRICE_CHECK → ACCEPTED | REJECTED → OPEN → SETTLED (WON|LOST|HALF_WON|HALF_LOST|PUSH) | VOIDED | CASHED_OUT`
- **Risk management** — per-market liability caps, per-user stake factoring, auto-suspend on liability breach, arbitrage and syndicate detection, sharp-user flagging
- **Integrity monitoring** — IBIA or equivalent feed; suspicious-pattern reporting obligation
- Live streaming + scorecard where rights permit (budget the rights cost explicitly)

### 11.5 Casino & live casino

- **Aggregator integration** (SoftSwiss, EveryMatrix, Pragmatic aggregation) — one integration, hundreds of certified titles. Do not integrate studios individually
- **Seamless wallet** — game rounds debit/credit in real time. **Every provider callback must be idempotent by transaction ID**; duplicate callbacks are routine, not exceptional. Rollback support mandatory
- Lobby: category, search, provider filter, **RTP display where mandated**, demo/play-money mode where permitted
- Certified content only — GLI/eCOGRA/iTech Labs. **No operator-controlled RTP, no uncertified in-house games**
- Game round history retrievable per user for dispute resolution
- DE restrictions per §10.3

### 11.6 Horse racing

Fixed-odds and exchange markets on racing. **Pari-mutuel/tote is a distinct regulated product** in most markets, frequently requiring a separate licence or a tote-operator partnership — a Phase 3 decision, not a Phase 1 feature.

### 11.7 Responsible gambling — launch blocker, not a feature

- **Limits** — deposit (daily/weekly/monthly), loss, wager, session duration. **Decreases immediate; increases only after a cooling-off period** (24 h–7 d by market)
- **Reality checks** — configurable interval, showing session duration and net position, requiring acknowledgement
- **Time-out** — 24 h to 6 weeks, self-service, immediate
- **Self-exclusion** — 6 months to permanent; propagated to the national register; blocks login, marketing and reopening for the full term
- **Behavioural risk model** — detect markers of harm: loss-chasing, stake escalation, session-length spikes, night-time play, failed-deposit retry loops, deposit-frequency change. Tiered intervention workflow. **Every alert, action and outcome logged for the regulator**
- **Affordability checks** at defined thresholds
- **Marketing suppression wired to RG state at the platform level, not in the CRM.** A self-excluded user receiving a promotional email is a reportable breach

### 11.8 Bonusing & promotions

- Bonus wallet separate from cash; wagering-requirement tracking; contribution weighting by game type
- Free bets, odds boosts, deposit matches, cashback
- Jurisdictional constraints enforced in configuration — SE first-deposit-only; DE/NL/IT advertising limits
- **Plain-language terms pre-opt-in.** Opaque wagering requirements are among the most common regulatory findings in this sector
- Bonus-abuse detection: multi-accounting, low-risk-betting patterns to clear wagering

### 11.9 Affiliates — replacing the agent model

- Tracked links; cookie **and** server-side attribution; configurable window
- **Revenue share on NGR, CPA, or hybrid. Affiliates never hold player funds and never issue accounts.**
- Negative carryover policy configurable and clearly disclosed
- **The operator is liable for affiliate marketing.** Requires content pre-approval, ongoing monitoring, and a fast termination path
- Full audit trail per affiliate

### 11.10 Back-office

- **Trading console** — exposure by market/event/sport, suspend, void, resettle (dual-auth), liability alerts. *(The reference platforms' "Market Analysis" view is the right idea; this is its licensed equivalent.)*
- **Compliance console** — KYC queue, AML alert triage, SAR drafting and filing, RG intervention log, regulator report generation
- **Support console** — account view, bet and game history, scoped adjustment powers with mandatory reason codes
- **Immutable audit log across all three.** Every action attributable to a named operator, timestamped, with before/after state. First thing an auditor asks for
- **RBAC with segregation of duties** — whoever can adjust a balance must not be whoever approves it

### 11.11 Obligations with no home elsewhere in this spec

Added after review. Each is a licensing requirement that had no owning section, and several are the kind of thing discovered during audit rather than during design.

**Player funds segregation — mechanics, not just a principle.** §10.2 lists it as a launch blocker but nothing specified how it works. Requirements: customer funds held in a designated client-money account separate from operating funds; **aggregate player liability calculable on demand and reconciled daily** against the segregated balance; a published protection rating (the UK tiering is *not protected* / *medium* / *high*, and the rating must be disclosed to customers at registration). The ledger must be able to produce the liability figure as a first-class query — it is not a report someone assembles.

**Complaints and Alternative Dispute Resolution.** A documented internal complaints procedure with a defined response SLA, and escalation to an **approved ADR provider** (mandatory in the UK; equivalent requirements in most markets). Complaint records retained, and in several markets complaint volumes are reported to the regulator. §5.6 correctly identified the absence of a complaints route as a defect in the reference platforms and then failed to specify one here.

**Terms & conditions versioning.** Versioned with an immutable history of which version each user accepted and when. Material changes require re-acceptance before next play. The accepted version must be retrievable years later for dispute resolution — "the current T&Cs" is not an answer to "what did this customer agree to in 2027".

**Dormant accounts.** Definition per market (commonly 12 months without activity). Several markets **prohibit dormancy fees** and require reasonable effort to return funds to the customer. Unclaimed-funds treatment is jurisdiction-specific. Not a feature anyone remembers until a regulator asks.

**GDPR erasure versus AML retention — these directly collide.** A customer exercising the right to erasure cannot cause deletion of records held under a five-year AML legal obligation. Erasure must therefore be **selective**: marketing profile, preferences and behavioural data erased; identity, transaction and monitoring records retained under the legal-obligation basis, with that basis recorded against the retained set. A naive `deleteUser()` breaches AML; refusing erasure outright breaches GDPR. Design the split explicitly — this is one of the few places where two regulators want opposite things.

**Certification environment.** Test labs (GLI/eCOGRA/iTech) need an environment that exercises every game and market path, with deterministic RNG seeding where applicable. It is a deliverable with a lead time, not a staging environment that happens to exist.

### 11.12 Specified but unscheduled — scope decision required

Two modules are specified in this document, have decisions recorded against them, and appear in **no workstream and no milestone**. That is a gap in the plan, not in the spec.

- **§11.8 Bonusing & promotions**
- **§11.9 Affiliates** (D2 — the designated replacement for the rejected agent model)

Neither is required for a compliant launch, so neither is a launch blocker. But launching with **no bonus mechanism and no affiliate channel means no acquisition engine at all** — which is a commercial decision the client must make deliberately rather than discover. Either schedule them into Phase 1, defer them to Phase 2 explicitly, or accept a launch with organic acquisition only. See §16 Q7.

## 12. Non-functional requirements

| Area | Requirement |
|---|---|
| Exchange match latency | P99 < 150 ms submission → book |
| Price stream latency | P99 < 250 ms provider → client |
| Availability | 99.9%; 99.95% during scheduled major events |
| Peak load | **Assumption, calibrate before building to it:** ~20× average at major-event kick-off. In-play traffic being extremely spiky is a domain fact; the specific multiplier is a placeholder and must be replaced with the feed provider's observed figures for the target sports before capacity planning or load-test targets are set |
| Settlement accuracy | 100%. Any discrepancy is a P1 |
| Data retention | ≥ 5 years (AML); per-market variation |
| Data residency | Per licence; several markets require in-country or in-EEA |
| DR | RPO < 1 min (ledger, bets); RTO < 30 min |
| Security | Pen test pre-launch and annually; PCI-DSS scope minimised via PSP tokenisation |
| **Geo-blocking** | Hard block on all non-licensed territories |
| Domain | **One stable whitelisted domain per market.** No mirrors, no rotation |

## 13. Integration surface & open-source component map

### 13.1 Commercial integrations

| Category | Purpose | Candidates |
|---|---|---|
| Odds/data feed | Pricing, fixtures, live data, results, settlement | Sportradar, Betgenius — **primary cost centre** |
| Casino aggregator | Content + seamless wallet | SoftSwiss, EveryMatrix |
| KYC/AML | ID verification, liveness, PEP/sanctions, ongoing monitoring | Jumio, Onfido, Sumsub |
| PSPs | Deposits/withdrawals per market | Multi-PSP, routed, with failover |
| Self-exclusion registers | Statutory | GAMSTOP, Spelpaus, CRUKS, OASIS, ROFUS |
| Regulatory reporting | Statutory feeds | DK SAFE, IT ADM, DE LUGAS |
| Integrity monitoring | Suspicious pattern reporting | IBIA |
| Exchange liquidity | Market making | Proprietary trading firms — **commercial, not technical** |
| CRM | Lifecycle messaging | Must consume RG state |

### 13.2 Open-source components

Nothing gambling-specific worth using is open source. The betting-adjacent repositories on GitHub are matched-betting calculators, tracking tools and Web3 prediction-market demos — none of it a foundation for a licensed platform.

**But the two genuinely hard components of this build — the ledger and the matching engine — are solved problems in fintech**, with mature open source behind them. That is where to look, not at the gambling segment.

#### Core — directly addresses the hardest requirements

| Need | Component | Licence | Fit |
|---|---|---|---|
| **Double-entry ledger** (§11.2) | [**TigerBeetle**](https://github.com/tigerbeetle/tigerbeetle) | Apache 2.0 | **Strong.** Double-entry is native to the data model, not imposed on top. ACID, strict serializability, 1M+ transfers/sec. Purpose-built for exactly the §11.2 requirement — the correctness and audit properties come from the database rather than from application discipline |
| Ledger (alternative) | [Formance](https://formance.com/) | MIT | Programmable-workflow oriented, more general-purpose. Worth evaluating against TigerBeetle if money-movement orchestration matters more than raw throughput |
| **Order matching** (§11.3) | [**exchange-core**](https://github.com/exchange-core/exchange-core) | Verify before adopting | **Strong reference, careful adoption.** Java, LMAX Disruptor-based, ~5M ops/sec single order book. Ships GTC / IOC / FOK order types, maker-taker fees, two order-book implementations, pipelined multi-core processing. Built for financial exchanges — betting-specific semantics (keep-in-play, market suspension, void/resettle) are yours to add |
| Matching (concurrency pattern) | [LMAX Disruptor](https://lmax-exchange.github.io/disruptor/disruptor.html) | Apache 2.0 | The canonical low-latency inter-thread pattern, published by a firm that built an actual exchange. Read this before designing the matching path |
| Matching (academic reference) | [CoinTossX](https://www.sciencedirect.com/science/article/pii/S2352711022000875) | Open | Low-latency, high-throughput matching engine with a published paper. Useful as a design reference and for validating throughput assumptions |
| **Multi-PSP orchestration** (§11.2) | [**Hyperswitch**](https://hyperswitch.io/) | Apache 2.0 | **Strong.** Rust. Rule-based, volume-based and cost-optimised routing with automatic failover and retry to a backup PSP. Directly implements the §11.2 "multi-PSP with routing and failover, never single-source" requirement rather than approximating it |
| **Immutable audit log** (§11.10) | [**immudb**](https://immudb.io/) | Apache 2.0 | **Strong.** Cryptographic verification per transaction; history cannot be altered or deleted without detection. v1.11 added built-in audit logging and PostgreSQL compatibility. Turns "we log admin actions" into "admin actions are provably untampered" — materially better in an audit |
| **Long-running money workflows** | [Temporal](https://temporal.io/) | MIT | Settlement, payouts, KYC escalation, manual-review queues, bonus wagering — all long-running, all needing compensation on failure. Durable execution removes an entire class of half-completed-money-operation bugs |

#### Supporting infrastructure

| Need | Component | Notes |
|---|---|---|
| Sanctions / PEP screening | [OpenSanctions](https://www.opensanctions.org/) | 443 sources; sanctions, PEPs, watchlists. **⚠ Free for non-commercial only — commercial use requires a data licence or the paid API.** Budget it |
| Identity & session | Keycloak · Ory Kratos · Zitadel | All Apache 2.0. Standard OIDC. Account state machine (§11.1) sits on top |
| Fine-grained authorisation | [OpenFGA](https://openfga.dev/) | Apache 2.0. Good fit for §11.10's RBAC-with-segregation-of-duties — the "whoever adjusts a balance must not approve it" constraint expressed as policy rather than scattered checks |
| Real-time price streaming | Centrifugo | MIT. WebSocket fan-out at scale — the §12 P99 < 250 ms price-stream requirement |
| Event backbone | Kafka · Redpanda · NATS | Event sourcing for bet/market lifecycle; absorbs the 20× in-play spike |
| Analytics | ClickHouse | Apache 2.0. Bet, market and behavioural analytics; feeds the §11.7 risk model and regulatory reporting |
| Feature flags | Unleash · Flagsmith · OpenFeature | **More important here than in most builds** — jurisdictional variants (§10.3) are config, not forks |
| Geolocation | MaxMind GeoLite2 · IP2Location LITE | §12 geo-blocking. **⚠ Attribution and redistribution conditions apply** |
| Load testing | k6 (AGPL) · Gatling | Required to validate the 20× spike assumption before a major event proves it for you |
| Observability | OpenTelemetry · Prometheus · Grafana | Standard |
| Secrets | Vault · OpenBao | Standard |

> **Licence caution.** Verify every licence at adoption — they change, and three above carry conditions that matter commercially: **OpenSanctions** (non-commercial only in its free tier), **MaxMind GeoLite2** (attribution/redistribution terms), **k6** (AGPL). `exchange-core`'s terms should be confirmed directly before it goes anywhere near production.

#### Where open source runs out

No viable open-source option exists for any of these — they are licensed data, licensed content, or statutory interfaces:

- **Odds / live data feed** — commercial only, and the primary cost centre
- **Casino content** — commercial only; certification is the point
- **ID document verification + liveness** — OCR and face libraries exist, but a self-assembled IDV stack will not satisfy a regulator. Buy this
- **National self-exclusion registers** — statutory interfaces, operator-specific credentials
- **Regulatory reporting feeds** — statutory formats; build to spec
- **Lab certification** — a service, not software

**Net position:** open source covers the *infrastructure* — ledger, matching, payments routing, audit, identity, streaming, analytics. It does not cover the *regulated surface*. That remains licensed data, licensed content, bought vendors, and code you write.

---

# PART III — DELIVERY

## 14. Phasing

| Phase | Scope | Exit gate |
|---|---|---|
| **0 — Licensing & foundations** | Licence application, corporate + banking, vendor selection, ledger/identity/wallet core, RG framework | Licence granted or in final review; ledger reconciles under load |
| **1 — Sportsbook + Casino** | Fixed-odds sportsbook, aggregated casino, full KYC/AML/RG, back-office, one market | Regulator sign-off; independent audit passed |
| **2 — Exchange** | Order book, matching, exposure engine, commission, trader API. Closed beta until liquidity is contractually solved | §9.3 spread and match-rate targets met in beta |
| **3 — Scale** | Second market, racing/tote decision, native apps, advanced trading tools | — |

> **Phase 0 is longer than engineering teams expect.** Licence applications commonly run **4–12 months**, and several jurisdictions require the platform to be materially complete and lab-certified *before* grant. **Schedule engineering against the licence timeline, not the reverse.**

## 15. Risk register

> ### The strongest objection to this entire plan
>
> **The differentiator is gated behind something a new operator is unlikely to obtain.**
>
> The business case rests on the exchange being what distinguishes this product. D11 correctly gates the exchange on a contractual market-making commitment — but market makers go where order flow already exists. A brand-new operator with no users has little to offer a proprietary trading firm, which means the most probable outcome of this plan as written is **a competent sportsbook-and-casino that never ships its differentiator**, competing on price and content with hundreds of established operators.
>
> That is not an argument for removing the gate — launching an empty order book is worse. It is an argument for confronting the question *now*, because it determines whether the business is viable at all. Options, none free:
>
> 1. **Operator-seeded liquidity.** The operator makes its own market. Effective, but it means being the counterparty on an exchange — which must be disclosed, is restricted in several jurisdictions, and blurs the exchange/sportsbook distinction that justified the product.
> 2. **Single-market focus.** Launch the exchange on one high-liquidity market (one league, one market type) rather than broad coverage. Concentrates thin liquidity where it is visible.
> 3. **Liquidity partnership.** Source pricing and depth from an established exchange rather than bootstrapping a book. Reduces the differentiator to a distribution play.
> 4. **Drop the exchange.** Ship sportsbook + casino, compete on product quality, and stop paying for a differentiator that will not arrive.
>
> **This belongs in the first client conversation, not in Phase 2.** See §16 Q8.

| Risk | Impact | Mitigation |
|---|---|---|
| **Exchange liquidity never bootstraps** | Module worthless; build cost sunk | Contractual market-making as a Phase-2 entry gate. Do not build on hope. **See the callout above — this may be the decisive commercial question in the project** |
| **Reference-platform mechanics leak into the build** | Licence refusal | §7 is a review checklist, not commentary. Gate every sprint against it |
| Licence delayed or refused | Total programme block | Gambling-licensing counsel from Phase 0 day one; pick a pragmatic first market |
| Payment rails withdrawn | Cannot take deposits | Multi-PSP from day one. Never single-source |
| Regulatory fine / licence breach | Existential | Compliance as architecture, not workflow. Audit log and RG state are core services |
| Odds feed cost at low volume | Margin destruction pre-scale | Volume-tiered terms; launch a reduced sport set |
| Vendor association with §2/§6 segment | Licensing and banking friction | Exclude clone-platform vendors from procurement entirely |
| Budget modelled on reference economics | Severe underfunding | Rebuild on licensed assumptions — KYC €1.50–4.00/user, compliance headcount, and **current** duty (§10.4) |
| **Financial model built on stale duty rates** | Model wrong by more than any engineering estimate | §10.4. UK RGD nearly doubled in April 2026. Re-verify every rate at modelling time |

## 16. Open questions — blocking

1. **Which jurisdiction is the first licence, and what is its current status?** §10, §11.7 and §14 are all downstream. **Nothing should be built before this is answered.**
2. Is the client the **licensee**, or building B2B for a licensed operator? Changes liability and the entire compliance surface.
3. **Which of the three engines is the actual priority?** Casino-first is a materially smaller project. Exchange-first makes §11.3's liquidity problem the whole programme.
4. Any existing liquidity or market-making relationship? Any existing traffic to migrate — and if so, **from where**?
5. Markets beyond the first — determines whether the German variant (§10.3) is in scope.
6. Budget and timeline envelope, tested against §14's 4–12 month licensing reality.
7. **Bonusing and affiliates — in Phase 1, deferred, or accepted as absent?** §11.12. Launching with neither means no acquisition engine.
8. **How does the exchange get liquidity?** See the callout in §15. If there is no credible answer, the exchange is not a differentiator and the product strategy needs revisiting before anything is built.

## 17. Assumptions

1. The client holds, or is applying for, a licence in a specific EU/EEA jurisdiction.
2. Player-facing operations, funds and data remain within the licensed perimeter.
3. Casino content is aggregated, not built.
4. Odds and results come from a licensed commercial feed.
5. The client accepts that the licensed model differs **fundamentally** from the reference platforms and has budgeted accordingly.
6. The platform serves only territories covered by the client's licence(s).

## 18. Sources

Public sources consulted for Part I. Nothing below required authentication.

- [Diamond Exchange clone / white-label development — Innosoft Group](https://innosoft-group.com/diamond-betting-exchange-app-development-company/)
- [Diamond Exchange clone software — Bettoblock](https://bettoblock.com/diamond-exchange-clone-website-software-development/)
- [Diamond Exchange API & integration — BR Softech](https://www.brsoftech.com/blog/diamond-betting-exchange-api/)
- [White-label betting exchange solutions — Play Profits](https://playprofits.in/white-label-solutions/diamond-exchange-white-label/)
- [White-label betting exchange software — PieGaming](https://piegaming.com/betting-exchange-software/)
- [Betfair exchange white-label + API listing, $1,500 — Fiverr](https://www.fiverr.com/jaidayaln/give-you-betfair-exchange-api-with-white-label-platform)
- [Betfair Exchange API — official developer documentation](https://developer.betfair.com/exchange-api/)
- [Master / Super Master / Admin panel tiers (DL, MDL, SMDL) — admindlmdl.in](https://www.admindlmdl.in/)
- [Panel hierarchy, chip issuance and settlement mechanics — goadminpanel.com](https://www.goadminpanel.com/silver-exchange-silver-exch-id-2026-indias-1-master-and-admin-panel-provider-rental-and-sharing-guide)
- [Cricket fancy betting — session markets explained, SportsCafe](https://sportscafe.in/cricket/betting-guide/cricket-fancy-betting)
- [Lambi and Khado session market mechanics](https://www.backofhouse.art/forum/topic/tenexch-session-market-how-to-bet-on-lambi-khado/)
- [Cricket betting market taxonomy — TheTopBookies](https://www.thetopbookies.com/cricket-betting-markets)
- [India-facing live casino game lineup — Live Casino India](https://www.livecasinoindia.com/blog/top-5-indian-live-casino-games/)
- [Tiger Exchange casino inventory ("200+ games")](https://tigerexchange.us.com/)
- [Lotus365 casino inventory](https://lotus365ss.com/casino)
- [India blocks 300 further gambling platforms; 8,400 total — ETV Bharat](https://www.etvbharat.com/en/technology/india-blocks-over-300-illegal-gambling-and-betting-platforms-takes-total-crackdown-tally-to-8400-enn26032103786)
- [India blocks 300 illegal betting platforms — SiGMA](https://sigma.world/news/india-blocks-300-illegal-betting-platforms/)
- [Online Gaming Act 2025 — scope and AML impact, Zigram](https://www.zigram.tech/article/india-betting-apps-ban-2025-aml-impact/)
- [ED raids across Madhya Pradesh, Karnataka, Maharashtra — Deccan Herald](https://www.deccanherald.com/india/ed-conducts-raids-in-madhya-pradesh-karnataka-maharashtra-as-part-of-probe-against-illegal-betting-apps-2746445)
- [Betting exchange commission models — Wikipedia](https://en.wikipedia.org/wiki/Betting_exchange)

---

*Document ends. §10 and §7 should be reviewed with gambling-licensing counsel in the target jurisdiction before this specification is used to scope engineering work.*

---

# Appendix A — Implementer's notes

> **Internal. Strip this appendix before sending the document to the client.**

Written for whoever is quoting and building this, not for the operator.

## A.1 The scope trap — settle this before quoting

The reference material is a set of Indian-market exchange skins. A client who says "build this for Europe" may mean either:

- **(a)** "build a licensed European exchange, using those as a visual/functional reference", or
- **(b)** "clone those, we'll operate in Europe".

**(b) cannot ship**, and about half the work differs between the two readings. If the quote is written against (a) and the client meant (b), the gap surfaces mid-build as "where's the agent panel?" — and that argument happens after the money is committed.

**Get §7 explicitly signed off before pricing anything.** It is a one-page decision table; walking a client through it takes twenty minutes and converts an ambiguous brief into an agreed scope. If they push back on the rejected rows, that is a conversation worth having on day one rather than in month four.

## A.2 Estimation traps

Components that look small and are not:

| Component | Why it bites |
|---|---|
| **Double-entry ledger + reconciliation** | Looks like CRUD. Is the highest-correctness component in the system, needs to survive audit, and retrofitting it later means migrating live money. *§13.2 — TigerBeetle removes most of this trap if adopted early; it cannot be retrofitted cheaply* |
| **Exchange exposure engine** | Worst-case P&L across every runner, live, under partial fills. Genuinely hard, and serious users find every bug within a day. *Note: matching is the solved part (§13.2); exposure is the part you write* |
| **Seamless wallet idempotency** | Provider callbacks duplicate as normal behaviour. Naive implementations double-credit. Must be idempotent by transaction ID with rollback support |
| **Cash-out** | Presents as a button. Is a pricing problem |
| **RG + self-exclusion** | Cross-cutting — touches registration, login, deposit, wager, marketing, back-office. Cannot be bolted on at the end, which is exactly when teams try |
| **Regulatory reporting feeds** | Per-market, regulator-specified, frequently documented only in the local language |
| **Bet settlement edge cases** | Voids, dead heats, non-runners, abandoned matches, partial settlement, resettlement. Long tail, all of it money-affecting |
| **In-play traffic shape** | 20× spikes at kick-off (§12). Load characteristics are nothing like a normal web app |

## A.3 Dependencies outside your control — flag in writing, early

Slippage on any of these will otherwise be attributed to engineering:

- **Licence grant** — 4–12 months, gates launch entirely (§14)
- **Odds feed contract** — the sportsbook cannot be built against a feed that has not been signed. Commercial negotiation, not an engineering task
- **Casino aggregator contract** — same
- **PSP onboarding** — gambling MCC underwriting is slow and can fail
- **Market-maker agreement** — gates the exchange being worth launching (§11.3)
- **Lab certification** — GLI/eCOGRA scheduling is not instant, and it is a real budget line

State these as named external dependencies with owners at kickoff. It costs one paragraph and saves the "why is it late" conversation.

## A.4 Questions to answer before quoting

§16 covers the product-blocking questions. Additionally, for scoping purposes:

1. **Greenfield, or integrating with an existing platform?** Changes the estimate by multiples.
2. **Who holds the licence, and does it already exist?** If the answer is "we're applying", Phase 1 has no launch date yet.
3. **Who owns compliance sign-off on the client side?** If nobody is named, that work will drift toward whoever is building — price it or exclude it explicitly.
4. **Is there budget for lab certification and the feed contracts?** These are client costs, not build costs. Confirm they are known.
5. **What is "done" for Phase 1?** Regulator sign-off is a much later milestone than feature-complete.
6. **Which of the three engines actually ships first?** Casino-first is a materially smaller project than exchange-first.

## A.5 Contracting note

The operator holds the licence and carries the regulatory obligation — not the contractor building to spec. Worth ensuring the engagement terms say so plainly: client is responsible for licensing, regulatory approval and compliance sign-off; contractor builds to the agreed specification. Standard for regulated-sector contract work, and cheap to get in writing at the start.
