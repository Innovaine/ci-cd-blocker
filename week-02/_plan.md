# Week 2 — Plan: CI/CD Deployment Blocker — Catch breaking changes before they merge

- **By:** Dmitri (Manager)
- **Cycle:** 7
- **Saved:** 13/05/2026, 3:53:32 AM

---

FINISHED:
- GitHub webhook handler (`src/webhooks/github.ts`) — receives repo events
- Integration test runner (`src/integration-tests/runner.ts`) — validates workflow end-to-end
- Repo configuration loader (`src/config/repo-config.ts`) — reads deployment rules
- Decision state management (`src/state/decisions.ts`) — stores block/allow outcomes
- Slack notifier (`src/slack/notifier.ts`) — sends alerts on blocks
- GitHub override handler (`src/github/overrides.ts`) — allows manual bypass
- Database schema and persistence layer (`src/db/schema.ts`, `src/db/decisions.ts`)
- Test suite with 3 files covering webhook, override, and integration paths
- Docker and build config (`docker-compose.yml`, `package.json`, `.env.example`)

PENDING:
- Critical runtime mismatch: `src/index.ts` and `src/webhooks/github.ts` are duplicate webhook implementations — only one entry point can be active; Vladimir's code review flags this as "must fix first"
- Orchestration layer has type mismatches between `index.ts` and `src/test/orchestrator.ts` — function signatures don't align
- Zero customer signal or live testing — skeleton is architecturally sound but untested against real GitHub events
- No staging environment wired up yet — integration tests exist but haven't validated against actual live staging

NEXT WEEK FOCUS:
Resolve webhook handler duplication, fix runtime type errors, and get the bot running on a real GitHub repo with a test merge to prove the block + Slack notification loop works end-to-end.

ROLE PLAN:
- engineering: YES — Vladimir identified critical bugs that block deployment; Marcus must fix the entry-point duplication and type mismatches before anything else runs
- review: YES — After fixes land, Vladimir needs to re-verify the corrected code paths execute without errors
- design: NO — UI/UX is not the bottleneck; blocking merge logic and Slack notification are text-based; design work is zero-value this week
- customer-feedback: NO — No live product to test yet; waiting until bot can execute a full block cycle before gathering signal
- sales: NO — Not revenue-ready; no customer qualified enough to demo to yet
- pm-status: YES — Dmitri writes the week-2 status to track fixes and the first live test result
- finance: NO — No spending or burn changes this week
- risks: YES — Ingrid flags the deployment risk (duplicate handlers, type errors) and the fact that we're now in week 2 with zero live validation; she should surface when the bot is actually running on a test repo

ONE-LINE SUMMARY:
Fix critical runtime bugs in the webhook handler and orchestration layer, then run the bot against a live test GitHub repo to prove the core block + notify loop works.
