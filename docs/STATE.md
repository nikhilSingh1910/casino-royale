# STATE

**Read this first, every session.** Where we are, what's blocking, what's next.

Last updated: 2026-08-03

---

## Phase

**Phase 0 — Licensing & foundations.** No code yet. `PRD.md` is drafted to v0.2; `CLAUDE.md`,
`docs/ARCHITECTURE.md`, `docs/PLAN.md`, `docs/MILESTONES.md` and the decision log (**D1–D22**) are
in place.

A multi-agent adversarial review ran on **2026-08-04** — 142 findings, compiled in
`docs/REVIEW-FINDINGS.md`. **Documentation and factual corrections have been applied. The eight
architectural decisions it surfaced have not** — see `docs/ARCHITECTURE.md` §12.

Current milestone: **M0 — scaffold**, blocked on D6 **and now on ARCHITECTURE §12 items 1, 2, 3(a)
and 8**, all of which are ledger-shaped and unretrofittable per D5.

> **ID convention.** `B<n>` in the blocker table below is a **blocker**. `B<n>` in `docs/PLAN.md`
> and `docs/MILESTONES.md` is an **identity-core workstream item**. They are unrelated.

## Blocking

| # | Blocker | Blocks | Owner |
|---|---|---|---|
| **B1** | **Target jurisdiction not chosen** | All of Phase 1. Determines KYC timing, market types, RG defaults, reporting, residency | Client |
| B2 | Licensee identity unclear — is the client the licensee, or are we B2B for one? | Liability model, scope of compliance work | Client |
| B3 | Odds feed contract not signed | Sportsbook build | Client (commercial) |
| B4 | Casino aggregator contract not signed | Casino build | Client (commercial) |
| B5 | No market-making commitment | Exchange (Phase 2) is not worth building without it | Client (commercial) |

**B1 is the one that matters.** Everything downstream of it is guesswork until answered.
See `PRD.md` §16 for the full question set to put to the client.

## Not blocked — startable now

Phase 0 workstreams A–C in `docs/PLAN.md` are **jurisdiction-independent**. The ledger, money
primitives, odds ladder, identity core, audit store and job runner do not change based on which
regulator we end up under. Start there rather than waiting on B1.

## Next actions

1. Put `PRD.md` §7 (feature disposition) and §16 (open questions) to the client. Get §7 signed
   off before any estimate is given — see `PRD.md` Appendix A.1 for why.
2. Confirm the runtime/stack decision in `docs/DECISIONS.md` D6 before scaffolding — it is the one
   architectural decision marked provisional.
3. Begin **M0** then **M1** — `docs/MILESTONES.md`. A3 (ledger) and A5 (sweeper) implement D17
   together; the sweeper is not deferrable.

## Open questions carried

- Which of the three engines actually ships first? Casino-first is a materially smaller project
  than exchange-first (`PRD.md` §16 Q3).
- Is this greenfield, or integrating with something the client already runs?
- Is there budget for lab certification and the feed contracts? These are client costs.

## Notes

- `PRD.md` §10 (regulatory) was compiled from public sources and is **pending counsel review**.
  Treat it as a map, not a source of truth — `CLAUDE.md` §1.
- The reference platforms in `PRD.md` Part I were analysed without authenticating to them. Part I
  describes the platform *family* and does not claim per-site differentiation.
