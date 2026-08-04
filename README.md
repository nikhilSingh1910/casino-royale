# casino-royale

A **free-to-play virtual cricket betting game** — play-money only, no real money in or out (**D32**).
Cricket match-odds, bookmaker and fancy/session markets on virtual chips with no cash value.

No application code yet. This repository is the specification, the working contract, and the build
plan. It was originally specified as a licensed real-money platform; **D32 reframed it to play-money
only**, so the licensing/KYC/payments half is retained as reference but out of scope — see below.

---

## Read in this order

| Document | What it is |
|---|---|
| **[`docs/STATE.md`](docs/STATE.md)** | **Start here every session.** Current phase, what is blocking, next actions |
| [`PRD.md`](PRD.md) | The specification. Part I — reference-platform teardown · Part II — target product · Part III — delivery |
| [`CLAUDE.md`](CLAUDE.md) | The working contract. Binding on every coding session — the loop, the evidence rule, single-owner rules |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System shape, the money seam, failure modes, and **§12 — architectural decisions still open** |
| [`docs/PLAN.md`](docs/PLAN.md) | Build sequence by workstream and phase |
| [`docs/MILESTONES.md`](docs/MILESTONES.md) | 16 milestones (M0–M15), each ending in a demonstrable proof |
| **[`docs/CRICKET-MVP.md`](docs/CRICKET-MVP.md)** | **The active track.** Cricket-only Phase 1 — plan, architecture, CM-series milestones |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | D1–D32, append-only. Authoritative on *why*. **D32 governs scope** |
| [`docs/REVIEW-FINDINGS.md`](docs/REVIEW-FINDINGS.md) | Output of the 2026-08-04 adversarial review — 142 findings and their disposition |

---

## Current status

**No code written yet. Nothing blocks the build** — see [`docs/STATE.md`](docs/STATE.md).

**Scope (D32): play-money only, forever.** The active build is
[`docs/CRICKET-MVP.md`](docs/CRICKET-MVP.md) — an operator-priced cricket engine (match-odds /
bookmaker / fancy-session) on a chip-economy ledger.

This reframed the project on 2026-08-04. It was specified as a *licensed real-money* platform, so
roughly half those docs (licensing, KYC/AML, real payments, chargebacks, statutory RG, reporting)
are now **out of scope under D32**, kept as reference. The cricket engine is unchanged. Architectural
sign-offs D27–D31 stand (D31/chargebacks now void under D32).

---

## Evidence standard

`CLAUDE.md` §1 governs this repository: **every claim is grounded in a verified fact.** Regulatory
rules, tax rates, software licences and vendor capabilities are never asserted from memory.

Claims carry explicit tags — **[V]** verified with a cited source, **[D]** domain-standard, **[I]**
inferred and needing confirmation — and anything unverified is labelled as such rather than
quietly rounded up to fact.

This is enforced retrospectively too. A 2026-08-04 review found several claims in earlier drafts
that were inference presented as verification; each has been corrected in place with the correction
recorded rather than silently rewritten. `docs/REVIEW-FINDINGS.md` §8b is the primary-source
verification log, including what remains **unverified**.

---

## A note on Part I

`PRD.md` Part I analyses a family of Indian-market betting platforms supplied as the functional and
visual reference for this build. That analysis was produced entirely from **public sources** — no
authenticated session was opened against any of those sites, and no credentials appear anywhere in
this repository.

Part I describes the reference *platform class*. It does not claim per-site verification except
where a specific technical fingerprint is cited.
