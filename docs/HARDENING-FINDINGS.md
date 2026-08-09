# HARDENING AUDIT — findings (2026-08-09)

A second full-codebase adversarial audit, run after Phase 2 (PC1–PC5) shipped. Distinct from
`REVIEW-FINDINGS.md` (that was the *product/PRD* review; much of it is out of scope under D32).
This one audits the **code** as it stands at `6d2e527`.

## Method

A two-stage workflow: **13 quote-gated finders** (one per lens — ledger, settlement, placement,
concurrency, four-eyes, identity, boundaries, single-owner rules, N+1, money-typing, frontend,
test-rigour, docs-drift), each finding required to carry a verbatim code quote or be dropped →
**one adversarial skeptic per finding** (default *refuted* unless concretely reachable) → **my own
foreground re-read** of every confirmed finding with full context.

- 34 agents · ~2.47M tokens · 652 tool calls · 29 min.
- **21 raised → 11 confirmed, 10 dismissed.** Every confirmed item below was re-verified by me
  against the cited file:line (the sub-agents had thinner context; this is the EVIDENCE rule, §1).

Scope reminder (D32/D33): play-money, single Postgres store. KYC/AML/RG/self-exclusion/PSP/
jurisdiction/multi-currency/exchange-ladder/casino are **out of scope** and were not treated as flaws.

---

## Confirmed — material (fix first)

### H1 · Settled market can be resurrected for betting  — **high**
`src/features/cricket/market.service.ts:157-163`, `market.repo.ts:128-130`
`suspendMarket` runs an **unguarded** `UPDATE market SET status='suspended'` — it overwrites a
`settled` market. `reopenMarket` then sees `'suspended'` → sets `'open'`. Both endpoints are
single-auth (`trading.controller.ts` `@Roles('trader','admin')`). A settled market's outcome is
known; once reopened, placement accepts bets on it (`placement.service.ts:72/104/149` guard only
`status!=='open'`) and re-settlement pays them; the new open bets also evade
`countStrandedOpenBets` (which only flags open-on-*settled*). The method's own comment asserts the
invariant it breaks: *"A settled market cannot be reopened."* Violates §4 (settled is terminal).
**Fix direction:** enforce terminal-status server-side in the market-status owner — a `settled`
market cannot be suspended (nor otherwise transitioned back to open).

### H2 · Fancy exposure/liability under-counts across heterogeneous struck lines  — **high**
`src/features/cricket/exposure.ts:5-7,18`; `bet.repo.ts:63-64`
The fancy scenario set is hardcoded binary `[SESSION_OUTCOME, SESSION_MISS]`, and `toPosition`
collapses **every** fancy bet to `outcome=SESSION_OUTCOME` — the struck `line_value` is not even
carried into the `BetPosition`. But `repriceMatch` (`market.service.ts:123-126`) moves the line
each ball without touching open bets, and settlement pays each bet on **its own** struck line
(`settlement.ts:33`). So a back struck at line 10 and a lay struck at line 100 **both win** at an
intermediate runs value (e.g. 60), which neither binary scenario represents. The §5 rule-2
(`calculateCustomerExposure`) and rule-11 (`calculateOperatorLiability`) single-owners therefore
return materially wrong numbers, defeating the auto-suspend cap (`placement.service.ts:168-171`).
**Bounded impact:** the placement *reservation* is a fixed per-bet amount, not derived from these —
so no chip is mis-moved; the defect is wrong risk figures + a cap that can fail to fire. The C2 fix
(D47) generalised *runner* markets to N-outcome but left *fancy* hardcoded binary.
**Fix direction:** carry the struck line into the position and evaluate liability/exposure across
the real runs-boundary scenarios (the distinct struck lines), reusing the one `worstCase` engine.

### H3 · Cross-user data leak after account switch (shared browser)  — **high**
`web/src/lib/auth.tsx:16-27`
`signIn`/`signOut` mutate only `localStorage` + React state; they **never** clear the React Query
cache. Every per-user query keys on a user-agnostic string — `['balance']` (Header), `['me']`
(Nav/Admin/Account), `['myBets']`/`['statement']` (Account), `['leaderboard']` (carries a `you`
flag). With `staleTime:5000` + default 5-min gc, after user A logs out and user B logs in on the
same browser, B is served A's cached balance/bets — and A's `['me']` role reveals the Admin link to
B — until a refetch. Violates §4 (a shown balance must derive from the *current* user's ledger).
**Fix direction:** clear the query cache on every auth transition (single choke point in `auth.tsx`).

### H4 · Exposure/liability aggregate silently truncates open positions at 10 000  — **medium**
`src/features/cricket/placement.service.ts:170,183,191`; `bet.repo.ts` `positionsForMarket`
All three §5 exposure/liability consumers fold raw open-bet rows in JS, capped at
`POSITIONS_MAX=10000`, from a query with `.limit(10000)` and **no `ORDER BY`**. On a market past
10 000 open bets the risk-console read (`GET /trading/exposure/market/:id`) returns an arbitrary
subset **as an authoritative whole** — no `partial`/degraded signal (§3.10), silently under-reporting
book liability (§3.4, §5). `leaderboard()` (`bet.repo.ts`) already demonstrates the correct
non-truncating SQL `SUM`/`GROUP BY` pattern.
**Fix direction:** compute the aggregate in SQL (no row-count truncation), matching `leaderboard()`.

---

## Confirmed — low-severity polish

### L1 · Approved override can be left recorded-but-unapplied  — **low**
`src/features/trading/trading.service.ts:99-110`
`approve()` commits `status='approved'` and writes the approval audit **before** enqueuing the
`execute-override` job, non-atomically. If `jobs.send` throws (transient DB fault), the action is
`approved`+audited but no job was persisted and no override ran; nothing scans for `approved`
actions and re-`approve()` throws `ActionNotPendingError`. §4 durable-jobs invariant. Trigger is a
DB fault at a precise instant; no money mis-moves; manually detectable → low.
**Fix direction:** a recovery re-drive for stranded `approved` actions (a sweep, or enqueue-in-txn).

### L2 · `reject()` audit record omits before/after state  — **low**
`src/features/trading/trading.service.ts:137`
Every sibling console action records `before`/`after` (suspend 44-50, reopen 57-63, approve
102-108, propose 75); `reject` records only actor/action/subject/reason. §4 requires before+after
for **every** back-office action.
**Fix direction:** pass `before:{status:'pending', proposedBy}` / `after:{status:'rejected'}`.

### L3 · Signup error is an account-existence oracle  — **low**
`src/features/identity/auth.service.ts:38`
`signup` throws `AuthError('email already registered')`, passed verbatim to the client by
`DomainExceptionFilter`, while `login` goes to lengths to avoid leaking which emails exist
(`DUMMY_HASH` + uniform `'invalid credentials'`, auth.service.ts:45-47). Unthrottled (only
`/auth/demo` is rate-limited — the deliberate, documented choice in `rate-limit.ts:4`). Play-money,
info-disclosure only → low.
**Fix direction:** genericise the client-facing message (keep uniqueness enforced by the DB/repo).

### L4 · No 401 handling — stale token → stuck-logged-in SPA  — **low**
`web/src/lib/api.ts:25`
`req()` throws a typed `ApiError` on 401 but performs no auth side-effect; nothing anywhere clears
the session on 401. A 7-day-expired or revoked token stays truthy, so protected pages don't
redirect and every query errors permanently. Frontend-only, auth not bypassed, manual Logout
recovers → low.
**Fix direction:** on 401, clear auth + route to `/login` (single choke point in `api.ts`/query client).

### L5 · Operator match-selector has no error state  — **low**
`web/src/pages/AdminPage.tsx:123`
`MatchesTab` renders the match list only via `matchesQ.data ?? []` with no `isError` branch; a
failed `/matches` load looks identical to "no matches", no retry. HomePage/InPlayPage render
`ErrorState`+retry — the pattern was omitted here (§6 four states).
**Fix direction:** add the `isError` branch (reuse `ErrorState`).

### L6 · STATE.md backlog is stale in three places  — **low** (docs-drift)
`docs/STATE.md:170,173,175`
Three backlog items are listed as open but are already done: line 170 "the §5-rule-11 formula is
binary" (it's N-outcome since C2/D47); line 173 "settleDueMarkets … not yet drained (no queue
built)" (pg-boss queue built + drained, D45); line 175 "Saga gaps — reserve+bet atomicity,
operator-action claim↔execute" (both closed, D44/D45). STATE is the "read-first" doc (§0), so the
drift misleads. `[drift-1 + drift-2 + drift-3]`
**Fix direction:** correct/remove the three stale lines.

---

## Raised but dismissed (with reason)

- **settleBall reopen races** (`settlement-1/2`, `concurrency-1`) — the logic gap is **real**
  (`settlement.service.ts:62` reopens the bbb market with no terminal-status guard; match-end void
  refunds a still-open winning last ball) but **unreachable today**: the only `SETTLE_BALL` enqueuer
  is the non-prod demo ticker, and `JOBS_ENABLED=false` runs handlers inline/ordered.
  **⚠ Latent landmine** — becomes reachable the day a real feed adapter runs with the durable queue
  on. **Address when the feed adapter lands** (the H1 terminal-status guard, if centralised, also
  covers this).
- **`exposure-2`** — narrower framing of H4; the auto-suspend *cap* specifically is protected by the
  `FOR UPDATE` placement lock + the 10 000 threshold. Root captured by H4.
- **`idempotency-1`** (resettle double-credit) — refuted; `correctionId` is operator-**required**
  (`trading/schema.ts:10`). Same as last audit's refuted finding.
- **`auth-2`** (no login/signup throttle) — deliberate + documented (`rate-limit.ts:4`). Adjacent to L3.
- **`tests-1/2/3`** — not defects (current code correct) but real **test-coverage gaps**:
  struck-line settlement, won→lost resettlement, and P&L-formula agreement are unasserted (§3.12).

---

## Remediation groups (each runs the §2 loop; DRY/reuse per §3.2)

| Grp | Fixes | One-plan rationale |
|-----|-------|--------------------|
| **A** | H1 | terminal market-status guard, server-side (also covers the latent settleBall smell) |
| **B** | L1 + L2 | operator-console action integrity (both `trading.service.ts`) |
| **C** | H2 | fancy exposure/liability across real struck-line scenarios |
| **D** | H4 | non-truncating SQL aggregate for exposure/liability |
| **E** | H3 + L4 + L5 | frontend session/auth hygiene (all `web/src`) |
| **F** | L3 | genericise signup error |
| **G** | L6 | STATE.md drift |
| **H** | tests-1/2/3 | close the §3.12 coverage gaps (plus tests for A/C/D fixes) |

## Disposition (updated as groups land)

- A — H1 — **DONE** (atomic `transitionStatus` guard; settled is terminal; +2 tests). `6d2e527`→pending commit
- B — L1, L2 — **DONE** (L1: `JobQueue.onReady` startup re-drive of stranded approvals; L2: reject records before/after; +2 tests)
- C — H2 — **DONE** (fancy `Resolution`/`sessionResolutions` across real struck-line intervals; +2 pure tests)
- D — H4 — **DONE** (SQL-aggregated positions grouped by side/runner/line — exact, bounded; no truncation)
- E — H3, L4, L5 — **DONE** (H3: `qc.clear()` on every auth transition; L4: 401→clear+redirect in `req`; L5: admin match-list error state)
- F — L3 — **DONE** (signup returns login's uniform `'invalid credentials'`; +1 test)
- G — L6 — **DONE** (STATE.md backlog lines 170/173/175 corrected — N-outcome liability, durable queue, closed sagas)
- H — tests — **DONE** (tests-1 struck-line-after-reprice; tests-2 won→lost resettle clawback; tests-3 left — formulas trivially aligned)

**All 11 confirmed findings remediated.** Backend 29 suites / 161 tests green (was 152 — +9); web green. Each group ran the §2 loop. Not yet committed.

## Latent (deferred, not a today-bug)
- settleBall reopen / match-end void races (`settlement-1/2`, `concurrency-1`): unreachable until a real feed adapter runs with `JOBS_ENABLED=true`. **Close when the feed adapter lands** — likely by routing the bbb reopen through a terminal-status guard like A's `transitionStatus`.
