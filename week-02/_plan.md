# Week 2 — Plan: CI/CD Deployment Blocker — Catch breaking changes before they merge

- **By:** Dmitri (Manager)
- **Cycle:** 6
- **Saved:** 13/05/2026, 3:41:19 AM

---

FINISHED:
- GitHub webhook handler skeleton (`src/github/overrides.ts`, `src/webhooks/` pattern established)
- Integration test runner scaffold (`src/integration-tests/runner.ts`)
- Repo configuration loader (`src/config/repo-config.ts`)
- Decision state persistence layer (`src/db/schema.ts`, `src/db/decisions.ts`, `src/state/decisions.ts`)
- Slack notification handler (`src/slack/notifier.ts`)
- Manual override handler logic (`src/github/overrides.ts`)
- Test suite structure (`src/__tests__/webhook.test.ts`, `src/__tests__/override.test.ts`, `src/__tests__/integration.test.ts`)
- Docker and build tooling (`docker-compose.yml`, `package.json`, `jest.config.js`)

PENDING:
- Critical: `src/index.ts` and `src/webhooks/github.ts` are duplicate webhook implementations — one will be dead code on deploy; CTO flagged this as "must fix" (type mismatch on `orchestrateTests` import path and dual route definitions)
- Critical: `orchestrateTests` function signature mismatch between call site (`src/index.ts` line 98) and implementation (`src/test/orchestrator.ts`) — async/return type unclear
- No live customer test yet — skeleton shipped but zero signal on whether the core idea (block on failed staging tests) resonates
- Override flow untested in live GitHub environment — manual bypass logic exists but never run against real PR

NEXT WEEK FOCUS:
Fix the dual webhook handler and orchestration import mismatch, then ship a live GitHub app instance and run it against one real test repo to confirm the merge-block flow works end-to-end.

ROLE PLAN:
- engineering: YES — fix the two critical architectural bugs (webhook duplication, orchestrateTests signature) and deploy to a test GitHub org; no new features, just make what's built actually run
- review: YES — Vladimir must re-review after fixes to confirm the app can boot and handle a webhook without runtime errors
- design: NO — no UI/UX work needed for MVP; Slack notifications and GitHub UI are pre-built
- customer-feedback: NO — premature; can't interview until the app is runnable; Chen waits until week 2 end when we have a live instance to show
- sales: NO — Fatima stands down; no outreach until we have a working product to demo
- pm-status: YES — Dmitri documents week 2 deliverables and flags whether customer signal emerges from the live test
- finance: NO — no budget decisions this week
- risks: YES — Ingrid watches the two critical bugs and the customer-feedback dry spell; if we can't fix the architecture bugs by mid-week, escalate to CEO

ONE-LINE SUMMARY:
Fix two critical runtime bugs and deploy a runnable GitHub app to one test repo; customer signal is the measure of week 2.
