# STATE

**Read this first, every session.** Where we are, what's blocking, what's next.

Last updated: **2026-08-04**

---

## Phase

**Phase 0 — Licensing & foundations. No code written.**

In place: `PRD.md`, `CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/PLAN.md`, `docs/MILESTONES.md`,
`docs/CRICKET-MVP.md`, `docs/REVIEW-FINDINGS.md`, and the decision log (**D1–D31**, append-only).

A multi-agent adversarial review ran on **2026-08-04** — 142 findings, compiled in
`docs/REVIEW-FINDINGS.md`, with a primary-source verification log at §8b.
**All corrections applied, and the four M1-gating architectural decisions were signed off on
2026-08-04 (D28–D31), with D6 confirmed (D27). M0 and M1 are unblocked** — see
`docs/ARCHITECTURE.md` §12. What remains open there is exchange-only (items 4, 6 — Phase 2) or
blocked on GGL (item 7).

> **Active track: CRICKET-ONLY MVP.** The client narrowed Phase 1 to the cricket product
> (2026-08-04 — D24, D25). The near-term execution spec is **`docs/CRICKET-MVP.md`** — plan,
> architecture and the CM-series milestones. It builds on the shared core (M0–M3, M5–M7);
> the casino and the true exchange are deferred.

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

### Architectural sign-offs — ✅ done 2026-08-04

| Decision | → | Status |
|---|---|---|
| D6 — TypeScript, matching engine behind an interface | D27 | **Confirmed** — M0 unblocked |
| §12 item 1 — reservation = posted transfer `cash→reserved`, per-user account, invariant | D28 | **Signed off** |
| §12 item 2 — sync where funds must block; async elsewhere | D29 | **Signed off** |
| §12 item 3a — currency in the ledger/account-ID scheme | D30 | **Signed off** |
| §12 item 8 — chargebacks: dispute-suspense, `reverse`, invariant rescoped | D31 | **Signed off** |

**M0 and M1 are both unblocked.** The remaining §12 items are exchange-only (4, 6 — Phase 2) or
blocked on GGL (7); none gates the cricket MVP.

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

**M0 and M1 are unblocked (D27–D31, 2026-08-04). The build can start.**

1. **Begin M0 — scaffold** (`docs/MILESTONES.md`): repo structure, layer-boundary lint,
   config-at-boot, CI rules. Nothing gates it.
2. **Then M1 — money core**, built to the signed-off decisions: per-user-per-currency accounts incl.
   dispute-suspense (D30/D31); reservation as a posted transfer `cash→reserved` (D28); sync/async
   money paths (D29). A5's sweeper is not deferrable; it is the completion half of the D17 write.
3. Put `PRD.md` §7 (feature disposition) and §16 (open questions) to the client — the remaining
   gating items are client-side, **B1 (jurisdiction)** above all.
5. **Start the cricket engine now on the demo feed** (D26) — cricbuzz11 or recorded fixtures behind
   the XC1.1 adapter; no contract needed to build XC1→XC5 / CM1→CM6 on **play-money**. The
   contracted production provider (SportMonks / CricketData — C-b) must be signed before **CM6 /
   real-money go-live**, not before work starts. A boot tripwire keeps the demo feed out of prod.
6. Cricket runs parallel to the compliance/payments track (M5/M6/M7); they only rejoin at CM6 for
   real-money go-live.

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
