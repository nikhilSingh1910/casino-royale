# casino-royale

Specification and delivery plan for a **licensed EU/EEA real-money wagering platform** — betting
exchange, fixed-odds sportsbook, and aggregated casino behind one identity and one wallet.

No application code yet. This repository is currently the specification, the working contract, and
the build plan.

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
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | D1–D25, append-only. Authoritative on *why* |
| [`docs/REVIEW-FINDINGS.md`](docs/REVIEW-FINDINGS.md) | Output of the 2026-08-04 adversarial review — 142 findings and their disposition |

---

## Current status

**Phase 0 — licensing and foundations. No code written.**

**Active near-term scope: cricket-only MVP** ([`docs/CRICKET-MVP.md`](docs/CRICKET-MVP.md)) — an
operator-priced cricket sportsbook on the shared money/identity core. The casino and the true
exchange are deferred (D24, D25).

Blocking:

- **B1 — target jurisdiction not chosen.** Determines KYC timing, permitted market types, RG
  defaults, reporting obligations and data residency. Most of Phase 1 is guesswork until answered.
- **Four architectural decisions** in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) §12 — items
  1, 2, 3(a) and 8. All are ledger-shaped and unretrofittable under D5, so they must be settled
  before Workstream A begins.

Phase 0 has four workstreams (A–D) and none needs to know which jurisdiction before starting.
Workstream C (scaffold) is gated only on D6; Workstream A is gated on §12.

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
