# Week 2 — Plan: CI/CD Deployment Blocker — Catch breaking changes before they merge

- **By:** Dmitri (Manager)
- **Cycle:** 8
- **Saved:** 13/05/2026, 4:45:23 AM

---

FINISHED:
- GitHub webhook handler receiving repo events (`src/webhooks/github.ts`)
- Integration test runner scaffold (`src/integration-tests/runner.ts`)
- Repo configuration loader (`src/config/repo-config.ts`)
- Decision state persistence layer (`src/db/schema.ts`, `src/db/decisions.ts`, `src/state/decisions.ts`)
- Slack notifier (`src/slack/notifier.ts`)
- Manual override handler (`src/github/overrides.ts`)
- Test suite skeleton (`src/__tests__/webhook.test.ts`, `src/__tests__/override.test.ts`, `src/__tests__/integration.test.ts`)
- Docker and build config (`docker-compose.yml`, `jest.config.js`, `package.json`)

PENDING:
- **Critical**: Duplicate webhook implementations (`src/index.ts` and `src/webhooks/github.ts`) — routing conflict, one must be removed
- **Critical**: `orchestrateTests()` import path mismatch in index.ts (references `./test/orchestrator` but function signature doesn't match callsite)
- **Critical**: No live staging environment connection — test runner has scaffold but no actual integration
- **Blocker**: Zero customer signal — no evidence anyone wants this; no user interview completed
- **Blocker**: Manual override UX undefined — how does engineer trigger it? CLI? GitHub UI comment? Not specified

NEXT WEEK FOCUS:
Fix runtime failures (routing conflict, orchestrator mismatch), connect to a real staging environment, and run one live deployment blocker test with an actual paying customer or internal dog-food scenario.

ROLE PLAN:
- engineering: YES — Two critical architectural bugs (duplicate webhooks, orchestrator mismatch) block deployment; Marcus must resolve routing and function signature before anything else runs.
- review: YES — Vladimir's "FIX FIRST" verdict still stands; revalidate that index.ts can actually execute after refactor, then clear for staging test.
- design: NO — No UX work needed this week; override mechanism and Slack layout are scoped-in and secondary to making the core logic work.
- customer-feedback: YES — Chen must complete one customer interview (or internal power user interview) this week to confirm someone actually has the "integration test fails, merge proceeds anyway" pain. Zero signal is the real blocker.
- sales: NO — No sales motion until there is a working product and one paying customer willing to be reference; Fatima's time better spent elsewhere.
- pm-status: YES — Dmitri (you) must write the week 2 status; be explicit about whether routing conflict is resolved and whether staging test ran.
- finance: NO — No spend or runway decision needed this week.
- risks: YES — Ingrid must flag: if staging environment doesn't exist internally or customer doesn't have one, this idea fails in week 2. Identify blockers now, not Friday.

ONE-LINE SUMMARY:
Fix two critical runtime bugs, wire to a real staging environment, and validate the pain exists with one real user test—everything else is secondary.
