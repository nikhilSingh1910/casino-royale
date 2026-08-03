# STATE

**Read this first, every session.** Where we are, what's blocking, what's next.

Last updated: **2026-08-04**

---

## Phase

**Phase 0 — Licensing & foundations. No code written.**

In place: `PRD.md`, `CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/PLAN.md`, `docs/MILESTONES.md`,
`docs/REVIEW-FINDINGS.md`, and the decision log (**D1–D23**, append-only).

A multi-agent adversarial review ran on **2026-08-04** — 142 findings, compiled in
`docs/REVIEW-FINDINGS.md`, with a primary-source verification log at §8b.
**Documentation and factual corrections have been applied. The architectural decisions it
surfaced have not** — see `docs/ARCHITECTURE.md` §12.

> **ID convention.** `B<n>` in the blocker table below is a **blocker**. `B<n>` in `docs/PLAN.md`
> and `docs/MILESTONES.md` is an **identity-core workstream item**. They are unrelated.

## Blocking

### Client decisions

| # | Blocker | Blocks | Owner |
|---|---|---|---|
| **B1** | **Target jurisdiction not chosen** | All of Phase 1. Determines KYC timing, permitted market types, RG defaults, reporting, residency | Client |
| B2 | Licensee identity — is the client the licensee, or are we B2B for one? | Liability model, scope of compliance work | Client |
| B3 | Odds feed contract not signed | Sportsbook build (M4 → M8) | Client (commercial) |
| B4 | Casino aggregator contract not signed | Casino build (M9) | Client (commercial) |
| B5 | No market-making commitment | Exchange (Phase 2) is not worth building without it | Client (commercial) |

**B1 is the one that matters.** Everything downstream is guesswork until answered.
See `PRD.md` §16 for the full question set.

### Architectural sign-offs

| # | Decision | Blocks |
|---|---|---|
| **D6** | TypeScript platform, matching engine behind an interface — the one decision marked *provisional* | **M0** (repo scaffold) |
| **§12 items 1, 2, 3(a), 8** | Reservation mechanism · sync-vs-async money paths · currency in the account-ID scheme · chargebacks | **M1 / Workstream A** — all ledger-shaped and unretrofittable per D5 |

**M0 is blocked only on D6.** The §12 items block **M1**, not M0 — scaffolding, lint and CI can
proceed while the ledger decisions are being made.

## Not blocked — startable now

Phase 0 has **four** workstreams (A–D in `docs/PLAN.md`) and all are jurisdiction-independent in
the sense that matters: none needs to know *which* regulator before starting.

> **One honest caveat**, raised by the review and not yet fully answered. "Entirely
> jurisdiction-independent" is a slight overstatement: the account state machine (B) encodes
> self-exclusion terms that vary by market, the money core (A) needs a currency decision that is
> jurisdiction-shaped (§12 item 3a), and WD3's German fixture is only a fixture. The claim holds
> for *sequencing* — start now, do not idle — but it should not be read as "B1 has no influence on
> Phase 0 at all."

## Next actions

1. **Sign off `docs/ARCHITECTURE.md` §12 items 1, 2, 3(a) and 8.** Three tasks in M1 (`A3.2`,
   `A3.3`, `A4.5`) are marked ⚠️ and must not be implemented as written until this is done.
2. Confirm or overrule **D6**, which unblocks M0.
3. Put `PRD.md` §7 (feature disposition) and §16 (open questions) to the client. Get §7 signed off
   before any estimate is given — `PRD.md` Appendix A.1 explains why.
4. Then **M0 → M1** (`docs/MILESTONES.md`). A5's sweeper is not deferrable; it is the completion
   half of the D17 write, not a safety net.

## Open questions carried

- Which of the three engines actually ships first? Casino-first is a materially smaller project
  than exchange-first (`PRD.md` §16 Q3).
- Bonusing and affiliates are specified and scheduled nowhere (`PRD.md` §11.12, §16 Q7). Launching
  with neither means no acquisition engine.
- Does the exchange have a credible liquidity path at all? (`PRD.md` §15 callout, §16 Q8.) The
  review made the exchange's architectural cost visibly higher without improving its liquidity
  outlook.
- Greenfield, or integrating with something the client already runs?
- Budget for lab certification and the feed contracts — these are client costs, not build costs.

## Notes

- `PRD.md` §10 (regulatory) is **pending counsel review**. Treat it as a map, not a source of
  truth — `CLAUDE.md` §1.
- **Several rates and rules remain unverified** against primary sources: Sweden's and Germany's
  duty, the AMLR application date, and the German tiered slot stake. `docs/REVIEW-FINDINGS.md` §8b
  lists exactly what is verified and what is not. The session that produced them exhausted its
  web-search budget; finish this in a fresh session.
- Part I of `PRD.md` was produced **entirely from public sources** — no authenticated session was
  opened against any reference site, and no credentials appear in this repository. Note that §2.0
  *does* now carry per-site technical fingerprinting; the earlier claim that Part I made no
  per-site distinction is superseded by **D22**.
