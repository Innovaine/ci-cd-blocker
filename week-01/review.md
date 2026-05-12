# Week 1 — Code review: CI/CD Deployment Blocker — Catch breaking changes before they merge

- **By:** Vladimir (CTO)
- **Cycle:** 2
- **Saved:** 13/05/2026, 12:50:07 AM

---

```markdown
# Week 1 — Code Review

## Verdict: FIX FIRST

Multiple critical runtime failures and architectural mismatches between files. Code will not execute correctly on first deploy.

---

## 🔴 Critical bugs (must fix)

### `src/index.ts`
- **Lines 85–108**: `orchestrateTests()` called, but import is from `'./test/orchestrator'`. File exists but exports `TestResult` and `TestContext`; however, the function signature in index.ts passes `(config, testContext)` while the actual `orchestrateTests` in `src/test/orchestrator.ts` is async and returns a `TestResult`. **Mismatch**: the import path in index.ts declares `import { orchestrateTests, TestContext }` but never imports `RepoConfig`. Line 98 calls `orchestrateTests(config, testContext)` where `config` is a `RepoConfig` — this will type-check in isolation but the function exists in `src/test/orchestrator.ts`. **The real issue**: `src/index.ts` and `src/webhooks/github.ts` are BOTH full webhook implementations with overlapping logic. Only one is used. When webhook fires, which handler runs? Express will match the first route — `/webhook` in index.ts. But then `src/webhooks/github.ts` is dead code. This is confusing and must be resolved. **Concrete failure**: if someone reads index.ts, they think the app is complete; if they read github.ts, they think that's the impl. Both are partially correct; neither is the truth.

### `src/index.ts` — audit endpoint
- **Lines 159–174**: `GET /api/audit/:owner/:repo` uses dynamic require inside the handler:
  ```typescript
  const { getDecisionsForPR, getRecentDecisions } = require('./db/decisions');
  ```
  This require happens on every request and bypasses TypeScript's compile-time module resolution. It will fail at runtime because the path is relative to src/index.ts, not node's module root. Should be a static import at the top. Concrete failure: first GET /api/audit request will throw "Cannot find module" error.

### `src/db/decisions.ts` — type mismatch
- **Line 29**: `failure_details` is stored as JSON string (`JSON.stringify(params.failure_details)`), but `Decision` interface declares `failure_details?: string`. The getter functions return rows directly from SQLite as `Decision[]`. The string is stored correctly, but callers will receive `failure_details` as an unparsed JSON string, not as the typed array. Code in `src/index.ts` line 106 calls `testResult.failures` (an array) and passes it to `recordDecision({ ..., failure_details: testResult.failures })`, which stringifies it. But the database returns the stringified version. If any code later tries to read `decision.failure_details` expecting an array, it will break. **Concrete failure**: `recordDecision` in index.ts line 106 and in decisions.ts line 29 — the array is stringified on insert, but no deserializer exists. When audit endpoint retrieves it, it's a JSON string, not an array.

### `src/github/overrides.ts`
- **Line 14**: `overrideTokens` is a Set created from `process.env.OVERRIDE_TOKEN.split(',')`. If `OVERRIDE_TOKEN` is unset or empty, `.split(',')` returns `['']`, and `filter(Boolean)` removes it, leaving an empty Set. But the filter call is correct. **However, line 68**: `setCommitStatusAfterOverride` is imported and called in `src/index.ts` line 133, but it's not exported from `src/github/overrides.ts`. The file exports `isValidOverrideToken`, `OverrideRequest`, and `applyOverride`. **Concrete failure**: `import { ... setCommitStatusAfterOverride }` in index.ts will fail at compile time OR runtime depending on build config. It's not defined in the file.

### `src/slack/notifier.ts` (imported as `src/notifications/slack.ts` in index.ts)
- **Import path mismatch**: `src/index.ts` line 11 imports from `'./notifications/slack'`, but the file exists at `src/slack/notifier.ts`. TypeScript will fail to resolve this. File listing shows both `src/slack/notifier.ts` and `src/notifications/slack.ts` — two different files. index.ts imports from the latter, but notifier.ts is the one provided in the review. **Concrete failure**: module not found error at runtime.

### `src/test/orchestrator.ts` — missing error handling on response data
- **Line 66**: 
  ```typescript
  const result: TestResult = response.data;
  ```
  No validation that `response.data` matches the `TestResult` interface. If the staging endpoint returns `{ passed: true }` (wrong key name) instead of `{ passed: true, failures: [] }`, the code assigns it directly. Line 69 checks `if (result.passed)` — if `passed` is undefined, this silently evaluates to falsy and logs "Tests failed," but there's no actual test failure, just a malformed response. **Concrete failure**: staging endpoint returns `{ success: true, failures: [] }` (using "success" instead of "passed"), code assigns it to `TestResult` typed as `{ passed: boolean }`, accessing `result.passed` returns undefined, and the PR is incorrectly blocked.

### `src/config/repo-config.ts` — parsing bug
- **Lines 22–31**: Config string parsing splits on `:` and `,`:
  ```typescript
  const pairs = envValue.split(',');
  for (const pair of pairs) {
    const [key, value] = pair.split(':');
  ```
  If the staging URL contains a comma (e.g., `https://staging.example.com,region=us-west`), the split fails. If it contains a colon (e.g., `https://staging.example.com:8080`), the split on `:` returns multiple parts and `[key, value]` destructuring only captures the first two. **Concrete failure**: `stagingUrl: "https://staging.example.com:8080"` is split into `["https", "//staging.example.com"]`, key="https", value="//staging.example.com" — the port is lost.

---

## 🟠 Spec / standard mismatches

### `src/index.ts` vs. `src/webhooks/github.ts`
- **Dual implementations**: The entry point defines a complete webhook handler in index.ts, including all logic (test orchestration, decision recording, Slack notification). Separately, `src/webhooks/github.ts` defines `handlePullRequestEvent()` which does similar work but is never called. The two files contradict each other on:
  - Where decisions are recorded (index.ts uses `recordDecision` from `./db/decisions`; github.ts calls `recordBlockDecision` from `../state/decisions` — two different modules)
  - How test results are handled (index.ts sets commit status inline; github.ts defers it)
  - Which database module is used (index.ts: `./db/decisions`; github.ts: `../state/decisions`)

### `src/state/decisions.ts` vs. `src/db/decisions.ts`
- **Two parallel state layers**: `src/state/decisions.ts` implements an in-memory `decisionsLog` array (MVP note says "in-memory only"). `src/db/decisions.ts` implements SQLite persistence. Code in index.ts imports and uses the database module (`./db/decisions`), but the in-memory module exists and is partially integrated. The engineer's notes say "in-memory rule store for now," but the codebase has both. This is confusing. Which is the source of truth?

### Missing database initialization in `src/index.ts`
- Line 29 calls `initializeDatabase()`, but if webhook endpoint is hit before that completes, or if the database fails to initialize, there's no retry or graceful degradation. If `initializeDatabase()` throws, the process crashes before `app.listen()`.

### `src/integration-tests/runner.ts` — fallback health check defeats merge block safety
- **Lines 46–54**: If the test endpoint (`/api/test/run`) is unreachable, the code falls back to a simple health check. If staging is up (responds 200 to `/health`), it returns `{ passed: true, failureCount: 0 }`. This means **if the staging environment is deployed but the test framework is broken or missing, the PR is approved anyway**. The engineer's assumption says "if we can't reach staging at all, block the merge," but the actual logic is "if the test endpoint is gone, assume no breaking changes." These are different safety models.

---

## 🟡 Missing edge cases

### `src/index.ts` — webhook signature verification
- **Line 43**: If `signature` header is missing, `req.headers['x-hub-signature-256']` is `undefined`. The function `verifyWebhookSignature(rawBody, undefined)` is called. Inside `verifyWebhookSignature`, line 26 does:
  ```typescript
  crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )
  ```
  If `signature` is `undefined`, `Buffer.from(undefined)` returns a buffer containing the string "undefined", not an empty buffer. This will not match the expected signature, so the webhook is rejected — which is safe, but the error message is misleading.

### `src/index.ts` — missing PR fields
- **Line 56**: The code destructures:
  ```typescript
  const owner = pull_request.head.repo?.owner?.login;
  const repo = pull_request.head.repo?.name;
  ```
  If `pull_request.head.repo` is `null` (which can happen if the PR is from a deleted fork), both are undefined. Line 62 checks `if (!owner || !repo ...)` and rejects with 400. But the real GitHub webhook payload guarantees these fields for `pull_request` events. However, if a test or mock webhook omits them, the error is generic. Not a bug, but fragile.

### `src/github/overrides.ts` — override token splits on comma
- **Line 14**: `process.env.OVERRIDE_TOKEN.split(',')` assumes the env var contains comma-separated tokens. If only one token is set (no comma), the split works fine. If the token itself contains a comma, this breaks. Not a likely real-world issue, but unclear from the spec whether multiple tokens are expected.

### `src/db/decisions.ts` — no connection pooling
- SQLite is opened once on startup. If multiple webhook requests hit the server simultaneously, each calls `getDatabase()` and uses the same connection. SQLite's WAL mode (line 39 in schema.ts) allows concurrent reads, but this is not documented. If the schema doesn't support it, you get "database is locked" errors under load.

### `src/test/orchestrator.ts` — timeout does not distinguish between no response and slow response
- **Lines 60–72**: If the staging endpoint takes 59 seconds to respond and the timeout is 60 seconds, the request succeeds. If it takes 61 seconds, axios throws a timeout error, and the code returns `{ passed: false, failures: [{ name: 'Test Orchestration Failed', error: <timeout message> }] }`. **The PR is blocked due to timeout, not due to test failure.** The slack notification will say "Integration tests failed," but the real issue is infrastructure latency. Not a bug per se, but the error message should distinguish.

### `src/config/repo-config.ts` — no validation of parsed values
- **Lines 23–31**: After parsing the env string, `config.testTimeoutMs = parseInt(value, 10)` can result in `NaN` if value is not a valid integer. Line 32 checks `if (!config.stagingUrl)`, but there's no check for `isNaN(config.testTimeoutMs)`. If the env var is malformed (e.g., `testTimeoutMs:abc`), the config silently contains `{ testTimeoutMs: NaN }`, and axios timeout will fail.

---

## ⚪ Maintainability (only if it actually matters)

### File organization
- Multiple modules define the same concept (decisions/state): `src/state/decisions.ts` vs. `src/db/decisions.ts`. Webhook handlers are split across `src/index.ts` and `src/webhooks/github.ts`. Slack notifications are in both `src/slack/notifier.ts` and `src/notifications/slack.ts`. This fragmentation will cause bugs as the code evolves. Not a blocker for week 1, but it matters now.

### Logger import inconsistency
- Some files import `'../utils/logger'`, others `'./logger'`. This works but is fragile if the directory structure changes.

### Test file imports path mismatch
- `src/__tests__/webhook.test.ts` imports `import { verifyWebhookSignature } from '../index'`, but `verifyWebhookSignature` is not exported from index.ts. It's defined as a private function. The test won't run.

---

## Recommended action for engineering next round

**Do not ship this. Pick one of the following before moving forward:**

**Option A (Minimal Fix):** Delete `src/webhooks/github.ts`, `src/slack/notifier.ts`, and `src/state/decisions.ts` (the in-memory layer). Consolidate everything into index.ts → test/orchestrator.ts → db/decisions.ts → notifications/slack.ts. Fix the import path for setCommitStatusAfterOverride (move it to a dedicated auth/override module or inline it). Fix the dynamic require in the audit endpoint. Validate the config parsing logic and response.data shape. Re-export verifyWebhookSignature or move the test to mock it. This path takes 4–6 hours.

**Option B (Refactor):** Recognize that index.ts is doing too much (webhook routing, test orchestration, decision recording, notifications). Break it into layers: `routes/webhook.ts` (handles HTTP, calls handlers), `handlers/pullRequest.ts` (orchestrates the decision flow), `services/testRunner.ts` (calls staging), `db/` (persists), `slack/` (notifies). This is cleaner for week 2 but takes 8–12 hours and may delay shipping.

**I recommend Option A.** You have 9 months of runway but execution fatigue is at 60/100. Ship a working MVP this week, then refactor if the product proves viable. The current code is 70% correct — the bugs are in integration, not logic.

**Specific fixes in priority order:**
1. Remove the duplicate files (github.ts, notifier.ts, state/decisions.ts).
2. Fix the import paths for notifications/slack and the missing setCommitStatusAfterOverride export.
3. Fix the dynamic require in the audit endpoint (move to static import).
4. Add response validation in test/orchestrator.ts line 66 (check that response.data.passed and response.data.failures exist before assigning).
5. Fix config parsing to handle `:` and `,` in values (use a more robust format like JSON or URL params).
6. Run the build (tsc) and the tests (jest) — they will catch the remaining issues.

```

---

PROGRESS:
- Round: 1
- Scope completion (this role for THIS week): 45%
- Remaining for this role:
  - Code does not compile or run — critical imports broken, dual implementations, type mismatches
  - Database layer not integration-tested against the webhook handler
  - Signature verification and override token validation need end-to-end test coverage
  - Response shape validation missing (staging endpoint contract not enforced)
  - Configuration parsing is fragile (handles URLs with ports/params incorrectly)
- Recommendation: keep_working

The engineer delivered 21 files with reasonable architecture and good assumptions, but the code has integration failures that will cause runtime errors on first deploy. Option A fixes are mechanical and can be done in 1 more round. After that, this is shippable.

---

## Round 2

# Week 1 — Code Review

## Verdict: FIX FIRST

Multiple critical runtime failures and architectural mismatch between module layers. Code will not compile or run in current state. Integration failures on first deploy.

---

## 🔴 Critical bugs (must fix)

### `src/index.ts` — Missing/mismatched imports
- **Lines 1–15**: Code imports from `./db/decisions`, `./db/schema`, `./integrations/github`, `./notifications/slack`, `./auth/override`, `./test/orchestrator` — but many of these files either don't exist or are named differently in the submission. `src/integrations/github.ts` doesn't exist (should be `src/github/overrides.ts`). `src/auth/override.ts` doesn't exist. `src/notifications/slack.ts` exists but the import path in index.ts line 12 is `'./notifications/slack'` while the file is at `src/notifications/slack.ts` — this works only if cwd is `src/`, which is wrong. **The build will fail.**

### `src/index.ts` — `setCommitStatusAfterOverride` import
- **Line 13**: Imports `setCommitStatusAfterOverride` from `'./integrations/github'`, but this function is defined in `src/github/overrides.ts` (line 60), not in a file at `./integrations/github`. **The import will fail at runtime.**

### `src/index.ts` — Dynamic require in audit endpoint
- **Lines 181–182**: 
  ```typescript
  const { getDecisionsForPR, getRecentDecisions } = require('./db/decisions');
  ```
  Uses `require()` in a TypeScript file compiled to CommonJS. This bypasses type checking. If the module exports change, the code fails silently. **Replace with static import at the top of the file.**

### `src/index.ts` — Database initialization error handling
- **Line 28**: `initializeDatabase()` is called on startup but has no error handler. If the database fails to initialize (missing write permissions, corrupted file), the process crashes before `app.listen()`. No graceful degradation or retry. **Add try-catch and log the error.**

### `src/integration-tests/runner.ts` — Fallback health check defeats safety
- **Lines 46–54**: If `/api/test/run` endpoint fails (4xx, 5xx, or timeout), the code falls back to a `/health` check. If health returns 200, the function returns `{ passed: true, failureCount: 0 }`. **This means a PR is approved even if the test runner is broken, as long as staging is up.** The engineer's notes say "if staging unreachable, block," but the code does the opposite: "if tests unreachable, pass." This is a safety inversion.

### `src/test/orchestrator.ts` — Response shape validation missing
- **Lines 59–72**: After `await axios.post(testEndpoint, ...)`, the code assumes `response.data` contains `{ passed: boolean, failures: Array }`. If the staging endpoint returns a different shape (missing `passed`, `failures` is not an array, etc.), the code crashes with `Cannot read property 'length' of undefined`. **There is no validation that the response matches the contract.** Add a type guard or schema validation.

### `src/config/repo-config.ts` — Unsafe parseInt
- **Line 28**: `parseInt(value, 10)` can return `NaN`. If the env var is `REPO_CONFIG_OWNER_REPO=testTimeoutMs:notanumber`, the config silently contains `{ testTimeoutMs: NaN }`. Later, axios receives `timeout: NaN`, which behaves unpredictably. **Check for NaN and reject invalid config.**

### `src/config/repo-config.ts` — URL parsing doesn't handle ports or query params
- **Lines 20–31**: The parsing splits on `:` to separate key from value. If `stagingUrl` contains a port or `:` in the value (e.g., `stagingUrl:https://staging.example.com:5000`), the split breaks. Line 21 becomes `['stagingUrl', 'https', '//staging.example.com', '5000']` after the first split, and only the first segment is assigned. **This will lose the port and protocol.** Use a more robust format (JSON, `key=value` with `;` separator, or environment variables per repo).

### `src/webhook/github.ts` — Undefined signature handling
- **Line 26** (in `verifyWebhookSignature`): If the header is missing, `signature` is `undefined`. Then `crypto.timingSafeEqual(Buffer.from(undefined), ...)` converts `undefined` to the string `"undefined"`, which won't match. The request is rejected, which is safe, but the log message is misleading. **Check for undefined signature before calling timingSafeEqual and return false explicitly.**

### `src/db/decisions.ts` — Import mismatch with index.ts
- **index.ts line 7** imports `recordDecision, recordOverride` from `'./db/decisions'`. But `src/db/decisions.ts` also imports from `./state/decisions` (doesn't exist) and defines its own `recordDecision`. **There are two implementations of the same function.** The code in index.ts uses the database version, but `src/state/decisions.ts` (in-memory) is also submitted. Which is the source of truth? This duplication will cause bugs.

---

## 🟠 Spec / standard mismatches

### `src/__tests__/webhook.test.ts` — Test imports non-exported function
- **Line 4**: `import { verifyWebhookSignature } from '../index'`, but `verifyWebhookSignature` is not exported from `index.ts` — it's defined as a private function (line 24). **The test will not run.** Either export the function or move it to a separate module that can be tested.

### `src/__tests__/override.test.ts` — Test assumes mutable env var
- **Lines 24, 32**: Tests set `process.env.OVERRIDE_TOKEN` and expect it to affect the module behavior. But `src/github/overrides.ts` line 14 reads `process.env.OVERRIDE_TOKEN` once at module load time into a `Set`. Mutating `process.env` after the module is loaded does not update the Set. **Tests will fail because the env var change is not reflected.**

### `src/notifications/slack.ts` — Missing `logger` import
- **Line 5** references `logger`, but there's no import. The file imports `axios` and types, but not the logger module. **Build will fail.**

### `src/notifications/slack.ts` — Unused import
- **Line 1** imports `axios`, but the module is not used anywhere (all axios calls would be in `sendSlackMessage`, which is not in this file). This is leftover code.

---

## 🟡 Missing edge cases

### `src/index.ts` — Missing PR fields don't provide dev-friendly error
- **Lines 54–62**: If `pull_request` is null, or if `head.sha` is missing, the webhook rejects with a 400 error. But the message is generic: `"Missing required fields in pull_request"`. If a GitHub webhook payload is malformed, the bot silently drops it and the developer doesn't know why. **Add more specific error logging (log the actual payload structure) so the dev can debug.**

### `src/index.ts` — Override endpoint has no rate limiting
- **Lines 165–227**: The `/api/override` endpoint accepts any POST request with a valid token. There's no rate limiting, no audit of override requests per user, and no cooldown. A compromised token can override unlimited PRs. For MVP, this is acceptable, but it should be documented.

### `src/index.ts` — Webhook endpoint returns success even if Slack notification fails
- **Lines 138–141**: If `notifyBlockedPR()` throws an error, the endpoint still returns 200 with `blocked: true`. The decision is recorded, the commit status is set, but the Slack notification is silent. This is actually safe (Slack is best-effort), but the response should indicate whether the notification succeeded.

### `src/integration-tests/runner.ts` — No retry on transient network errors
- **Lines 34–45**: If `axios.post()` fails with a transient error (DNS lookup failure, connection reset), the error is caught, logged, and the function returns `{ passed: false, failures: [{ name: 'staging-connectivity', error: '...' }] }`. **There is no retry logic.** If staging is momentarily unreachable, the PR is immediately blocked instead of waiting. Consider adding exponential backoff.

### `src/config/repo-config.ts` — Cache never invalidates
- **Lines 11–12**: Config is cached in a Map. If an environment variable is updated at runtime (via a deployment signal or config service), the cache is stale. For MVP, this is acceptable (restart to reload), but it's not documented.

### `src/github/overrides.ts` — Override allows merge even for unblocked PRs
- **Lines 40–43**: If a user calls `/api/override` for a PR that was never blocked (or already passed), the endpoint returns `{ success: true, message: 'PR is not blocked; no override needed' }`. The response is a 200, which looks like success to the caller, even though no override was applied. **Return 400 or 409 instead, since the request is invalid.**

---

## ⚪ Maintainability (only if it actually matters)

### Duplicate module implementations
- `src/state/decisions.ts` (in-memory) and `src/db/decisions.ts` (SQLite) both implement `BlockDecision` and decision recording. The webhook handler uses the database, but `src/webhooks/github.ts` imports from state. **This will cause data to be recorded in the database but not reflected in the in-memory log, breaking overrides.** Delete one.

### File organization fragmentation
- Webhook handling is split across `src/index.ts` and `src/webhooks/github.ts`.
- Slack notifications are in both `src/slack/notifier.ts` and `src/notifications/slack.ts`.
- Overrides are in `src/github/overrides.ts` (validation) and `src/auth/override.ts` (import path).
- Decision storage is split between `src/state/decisions.ts` and `src/db/decisions.ts`.

**This is not a bug, but it will cause bugs as the codebase evolves.** For week 2, consolidate: pick one path (`src/db/`, `src/services/`, `src/handlers/`) and move everything there.

### Missing error context in logs
- Most logger calls only log the high-level message. If an API call fails, the response status code or body is not logged. **This makes debugging production issues very hard.** Always include the error object, status code, and request context.

### No explicit exports
- `src/test/orchestrator.ts` exports `TestResult` and `orchestrateTests`, but other modules that use these do not import them by type. Type checking is loose. Use explicit `export type` for all interfaces.

---

## Recommended action for engineering next round

**Ship is blocked.** The code has three layers of integration failures that will cause crashes on first deploy: (1) missing/mismatched imports, (2) duplicate module implementations, (3) unvalidated response shapes and configuration parsing.

**Do not attempt to patch. Consolidate and validate instead:**

1. **Pick a single module structure.** Delete `src/state/decisions.ts`, `src/slack/notifier.ts`, and `src/webhooks/github.ts`. Keep only: `src/index.ts` (webhook HTTP), `src/test/orchestrator.ts` (staging calls), `src/db/decisions.ts` (persistence), `src/notifications/slack.ts` (Slack), `src/github/overrides.ts` (override validation).

2. **Fix imports in index.ts.** Replace all relative imports with correct paths. Move `setCommitStatusAfterOverride` to `src/github/overrides.ts` or export it explicitly. Replace the dynamic `require()` with a static import. Add error handling to `initializeDatabase()`.

3. **Add response validation.** In `src/test/orchestrator.ts` line 66, before using `response.data.passed` and `response.data.failures`, check that they exist and have the right types. Add a type guard or zod schema.

4. **Fix config parsing.** Replace the naive `:` split with JSON: `REPO_CONFIG_OWNER_REPO='{"stagingUrl":"https://...:5000","testTimeoutMs":120000}'`. Parse and validate. Or use separate env vars: `REPO_OWNER_REPO_STAGING_URL=...` and `REPO_OWNER_REPO_TIMEOUT=...`.

5. **Re-export testing functions.** Export `verifyWebhookSignature` from index.ts or move it to a separate module. Fix the override test to not mutate env vars at runtime.

6. **Run the build and tests.** `npm run build` and `npm run test`. The TypeScript compiler will catch remaining type errors. Fix all test failures.

**Estimated time: 3–4 hours.** This is mechanical consolidation, not a rewrite. After this pass, the code is shippable for week 1.

**Why this is worth doing:** The current architecture is sound (webhook → orchestration → decision → notification). The bugs are in integration details, not in design. Fixing them now prevents hidden failures in production and keeps the code maintainable for week 2 (overrides, audit trail, Slack formatting).

---

PROGRESS:
- Round: 1
- Scope completion (this role for THIS week): 35%
- Remaining for this role:
  - Code does not compile or run — import paths broken, missing exports, type mismatches
  - Duplicate module implementations (in-memory vs. database) must be consolidated
  - Response shape validation missing from orchestrator.ts (staging endpoint contract not enforced)
  - Configuration parsing is fragile (cannot handle URLs with ports, colons, special chars)
  - Integration tests do not run (non-exported functions, env var mutation assumptions)
- Recommendation: keep_working

---

## Round 3

# Week 1 — Code Review

## Verdict: FIX FIRST

Multiple critical runtime failures, missing exports, duplicate module implementations, and response validation gaps prevent this code from compiling or running. Architecture is sound; integration details must be fixed before shipping.

---

## 🔴 Critical bugs (must fix)

### `src/__tests__/webhook.test.ts` — Non-exported function import
- **Line 4**: `import { verifyWebhookSignature } from '../index'` fails. Function is defined as a private function in `index.ts` line 24 and never exported. Test will not compile. **Fix:** Export the function from `index.ts` or move it to a separate testable module (`src/utils/webhook-verify.ts`).

### `src/__tests__/override.test.ts` — Runtime env mutation doesn't affect loaded module
- **Lines 24, 32**: Test sets `process.env.OVERRIDE_TOKEN` after module load, but `src/github/overrides.ts` line 14 reads the env var once at import time into a `Set`. The `Set` is not updated. **Tests will fail silently.** **Fix:** Either (a) refactor `overrides.ts` to read env var inside the function, or (b) reload the module in the test using `jest.resetModules()`.

### `src/notifications/slack.ts` — Missing logger import
- **Line 5**: Code uses `logger.warn()` and `logger.error()` but there's no import statement. **Build will fail with "logger is not defined".** **Fix:** Add `import { logger } from '../utils/logger';` at the top.

### `src/index.ts` — Imports from non-existent modules
- **Lines 11–15**: Imports from `./notifications/slack`, `./auth/override`, `./integrations/github`, and `./test/orchestrator`. These paths do not match files in the submission. The actual files are `src/slack/notifier.ts`, `src/github/overrides.ts`, and `src/test/orchestrator.ts`. **Build will fail with "Cannot find module" errors.** **Fix:** Update all import paths to match actual file structure.

### `src/index.ts` — Duplicate decision storage logic
- **Lines 85–90**: Calls `recordDecision()` from `./db/decisions`, but `src/webhooks/github.ts` (which is not even used in index.ts) also calls `recordBlockDecision()` from `./state/decisions`. These write to different stores (database vs. in-memory). When override logic later queries decisions, it reads only in-memory state (from `src/github/overrides.ts` line 39), missing database records. **Data corruption risk.** **Fix:** Delete `src/state/decisions.ts` entirely. Use only `src/db/decisions.ts` for all decision storage.

### `src/index.ts` — Dynamic require without type safety
- **Lines 193–196**: `const { getDecisionsForPR, getRecentDecisions } = require('./db/decisions');` is a runtime require inside a handler. This is brittle and TypeScript-incompatible. **Fix:** Use static import at the top: `import { getDecisionsForPR, getRecentDecisions } from './db/decisions';`.

### `src/test/orchestrator.ts` — Unvalidated response shape
- **Lines 49–52**: Code assumes `response.data` has `passed`, `failures`, and optional `reportUrl`. If staging endpoint returns a different shape (e.g., `{ success: boolean, failures: Array }`), the code silently treats `passed` as `undefined`, evaluates to falsy, and the decision is "blocked" incorrectly. **Fix:** Add explicit type validation:
  ```typescript
  if (!response.data || typeof response.data.passed !== 'boolean') {
    throw new Error('Invalid response shape from staging endpoint');
  }
  ```

### `src/config/repo-config.ts` — Fragile environment variable parsing
- **Lines 24–29**: Code splits on `:` without escaping. If a staging URL is `https://staging.example.com:5000` (with a port), the split will produce `['stagingUrl', 'https', '//staging.example.com', '5000', ...]`, corrupting the value. **Fix:** Use JSON: `REPO_CONFIG_OWNER_REPO='{"stagingUrl":"https://staging.example.com:5000","testTimeoutMs":120000}'` and `JSON.parse()`. Or use separate env vars: `REPO_OWNER_REPO_STAGING_URL` and `REPO_OWNER_REPO_TEST_TIMEOUT`.

### `src/github/overrides.ts` — Unvalidated override token source
- **Line 14**: `const overrideTokens = new Set((process.env.OVERRIDE_TOKEN || '').split(',').filter(Boolean));` reads the env var once at module load. If the env var is empty or malformed, `overrideTokens` is an empty Set, and all overrides are rejected silently with no log. **No visibility into why overrides are failing.** **Fix:** Log the number of loaded tokens and emit a warning if none are found.

### `src/db/schema.ts` — Database initialization race condition
- **Lines 20–21**: `initializeDatabase()` is called in `index.ts` at startup, but there's no guarantee it has completed before the first webhook arrives. The database could be null during the first request. **Fix:** Make `initializeDatabase()` async and await it: `await initializeDatabase()` before starting the server.

---

## 🟠 Spec / standard mismatches

### `src/index.ts` — Webhook payload signature verification uses wrong encoding
- **Lines 34–41**: The signature verification compares two Buffer objects directly. If the signature from GitHub contains lowercase hex and the generated signature is uppercase (or vice versa), the comparison fails even though the signatures are semantically identical. **Fix:** Compare the strings before converting to Buffer, or ensure consistent case: `signature === expectedSignature`.

### `src/github/overrides.ts` — Missing commit status update
- **Lines 59–66**: After override is applied, the code calls `setCommitStatusAfterOverride()`, which updates GitHub to "success". But the function is not exported or defined in this file. Import path is `./integrations/github` which doesn't exist. **Fix:** Move the function definition into this file or import it correctly.

### `src/integration-tests/runner.ts` — Fallback health check contradicts spec
- **Lines 50–59**: If the test endpoint fails, the fallback returns `{ passed: true, ... }` on a healthy 200 response. But the spec says "health check passed" should not equal "tests passed". A healthy staging server with failing tests should return `{ passed: false }`. **Fix:** Either rename the function to `fallbackAssumption` and document it, or change the return value to `{ passed: false, failures: [{ name: 'no-test-endpoint', error: 'Staging does not expose test endpoint' }] }`.

### `src/slack/notifier.ts` — Unused import
- **Line 1**: `import axios from 'axios'` is declared but never used. All axios calls should be in `sendSlackMessage()`, which uses `axios.post()`. This suggests the module is incomplete or refactored partially. **Fix:** Remove the unused import or add the missing axios call.

---

## 🟡 Missing edge cases

### `src/index.ts` — Missing null check on pull_request.user.login
- **Line 134**: `prAuthor: pull_request.user.login` assumes `pull_request.user` exists and has a `login` field. If GitHub sends a webhook where `user` is null (rare but possible on certain events), this will throw. **Fix:** Add: `prAuthor: pull_request.user?.login || 'unknown'`.

### `src/index.ts` — No timeout on Octokit API calls
- **Lines 96–103** and **Lines 207–213**: Calls to `octokit.repos.createCommitStatus()` and `octokit.pulls.get()` have no explicit timeout. If GitHub API is slow, the webhook handler blocks indefinitely. **Fix:** Set a timeout: `octokit.repos.createCommitStatus({ ... }, { timeout: 10000 })` (requires Octokit options).

### `src/db/decisions.ts` — Unvalidated failure_details JSON parsing
- **Lines 17–18**: Stores `failure_details` as JSON string. But when retrieving, `getDecisionsForPR()` returns the row as-is, with `failure_details` still a string, not parsed back to an array. Calling code expects an array and will fail on `.map()` or `.length`. **Fix:** Parse `failure_details` in the return statements:
  ```typescript
  return stmt.all(...).map(row => ({
    ...row,
    failure_details: row.failure_details ? JSON.parse(row.failure_details) : []
  }));
  ```

### `src/test/orchestrator.ts` — No handling of 5xx responses from staging
- **Lines 66–78**: Code assumes a 2xx response. If staging returns a 500 or 502, axios will throw, caught as a generic error, and the PR is blocked with `"Test Orchestration Failed"`. But the error message doesn't include the HTTP status, making it hard to debug. **Fix:** Distinguish between timeout, 5xx, and network errors in the catch block.

### `src/config/repo-config.ts` — No validation that stagingUrl is a valid URL
- **Lines 26–29**: Stores any string as `stagingUrl`, even if it's malformed (e.g., `"not a url"`). When `orchestrateTests()` tries to POST to it, axios will throw. **Fix:** Add a URL validation: `new URL(config.stagingUrl)` to throw early if invalid.

### `src/github/overrides.ts` — Override token can be empty string
- **Line 14**: If `OVERRIDE_TOKEN` is set to an empty string or whitespace, `split(',').filter(Boolean)` will produce an empty Set. The code doesn't warn; all override attempts are silently rejected. **Fix:** Add a check: `if (overrideTokens.size === 0) logger.warn('No override tokens configured. Manual overrides will not work.');`

### `src/index.ts` — Missing database initialization error handling
- **Line 21**: `initializeDatabase()` is called with no error handling. If the database file is corrupted or disk is full, the error is uncaught and the server crashes before responding. **Fix:** Wrap in try-catch and respond with 503:
  ```typescript
  try {
    initializeDatabase();
  } catch (error) {
    logger.error(`Failed to initialize database: ${error}`);
    process.exit(1);
  }
  ```

---

## ⚪ Maintainability (only if it actually matters)

### Inconsistent error response shapes
- Some endpoints return `{ error: '...' }`, others return `{ success: false, message: '...' }`. Callers must handle both formats. **Fix:** Standardize to `{ success: boolean, message: string, code?: string }`.

### No request/response logging
- Webhook events are logged, but not the HTTP request body or response. If a webhook is malformed, there's no way to inspect what GitHub sent. **Fix:** Add middleware to log full request/response at debug level.

### Missing OpenAPI/type documentation
- No specification of webhook payload structure, response schema, or override endpoint contract. **Fix:** Add JSDoc comments to each endpoint handler documenting input/output types.

---

## Recommended action for engineering next round

**Do not attempt to deploy.** This code will not compile or run due to missing imports, duplicate module implementations, and unvalidated response shapes. You have a solid architecture—webhook → orchestration → decision → notification—but the integration points are broken.

**Mechanical fixes (do in order):**

1. **Delete the dead modules:** Remove `src/state/decisions.ts`, `src/slack/notifier.ts`, `src/webhooks/github.ts`. Keep only the canonical implementations: `src/db/decisions.ts`, `src/notifications/slack.ts`, `src/index.ts`.

2. **Fix all import paths in `src/index.ts`:**
   - `./notifications/slack` → `./notifications/slack`
   - `./auth/override` → `./github/overrides`
   - `./integrations/github` → inline the `setCommitStatusAfterOverride` function or define it in `./github/overrides.ts`
   - `./test/orchestrator` → `./test/orchestrator`
   - Replace the dynamic `require()` at line 193 with a static import.

3. **Fix response validation in `src/test/orchestrator.ts`:**
   ```typescript
   const result = response.data;
   if (!result || typeof result.passed !== 'boolean' || !Array.isArray(result.failures)) {
     throw new Error(`Invalid staging response shape: ${JSON.stringify(result)}`);
   }
   return { passed: result.passed, failures: result.failures };
   ```

4. **Fix config parsing in `src/config/repo-config.ts`:**
   Replace the `:` split with JSON parsing or separate env vars. Example:
   ```typescript
   const envValue = process.env[envKey];
   if (envValue) {
     try {
       const parsed = JSON.parse(envValue);
       config.stagingUrl = parsed.stagingUrl;
       config.testTimeoutMs = parsed.testTimeoutMs || 60000;
     } catch (e) {
       logger.error(`Failed to parse config for ${key}: ${e.message}`);
     }
   }
   ```

5. **Fix the override test:**
   ```typescript
   beforeEach(() => {
     jest.resetModules();
     process.env.OVERRIDE_TOKEN = 'test-token';
   });
   ```

6. **Add logger import to `src/notifications/slack.ts`:**
   ```typescript
   import { logger } from '../utils/logger';
   ```

7. **Export `verifyWebhookSignature` from `src/index.ts` or move to `src/utils/webhook-verify.ts` and test from there.**

8. **Run `npm run build` and `npm run test` and fix all remaining errors.** This should take 2–3 hours of mechanical work.

**After these fixes, re-submit for code review. The logic is correct; the wiring is broken.**

---

PROGRESS:
- Round: 3
- Scope completion (this role for THIS week): 45%
- Remaining for this role:
  - Verify all imports resolve and code compiles (`npm run build`)
  - Validate that tests run and pass (`npm run test`)
  - Add missing error handling (database init, webhook signature comparison, API timeouts)
  - Document webhook payload contract and override endpoint schema
  - Perform happy-path integration test: real GitHub webhook → database write → GitHub status update
- Recommendation: keep_working

---

## Round 4

# Week 1 — Code Review

## Verdict: FIX FIRST

Multiple critical runtime failures, missing exports, duplicate module implementations, and broken import paths. Code does not compile. Architecture is sound; wiring is broken.

---

## 🔴 Critical bugs (must fix)

### `src/index.ts` — Duplicate module implementations conflict
- **Lines 1–250**: File imports from `./notifications/slack`, `./auth/override`, `./integrations/github`, `./test/orchestrator`. But the codebase also contains `src/webhooks/github.ts`, `src/slack/notifier.ts`, `src/state/decisions.ts`, `src/github/overrides.ts`, `src/integration-tests/runner.ts`. These are **competing implementations of the same logic**. When TypeScript compiles, both modules exist; imports will resolve ambiguously or fail. **Fix:** Delete the dead implementations (`src/state/decisions.ts`, `src/slack/notifier.ts`, `src/webhooks/github.ts`, `src/integration-tests/runner.ts`). Keep only canonical versions in `src/db/`, `src/notifications/`, `src/test/`, `src/github/`.

### `src/index.ts` — Missing imports that don't exist
- **Line 11**: `import { setCommitStatusAfterOverride } from './integrations/github';` — File `src/integrations/github.ts` does not exist in the submission. The function is defined in `src/github/overrides.ts` (lines 59–78). **Fix:** Either move the function to a new `src/integrations/github.ts` file or inline it in `src/github/overrides.ts` and import from there.

### `src/index.ts` — Dynamic require bypasses TypeScript safety
- **Line 193**: `const { getDecisionsForPR, getRecentDecisions } = require('./db/decisions');` — This is a runtime `require()` in an async endpoint, not a static import. It will work but breaks the module dependency graph and makes it impossible to tree-shake or detect unused exports. **Fix:** Replace with static import at the top: `import { getDecisionsForPR, getRecentDecisions } from './db/decisions';`.

### `src/index.ts` — `crypto.timingSafeEqual` argument type mismatch
- **Lines 39–40**: Code calls:
  ```typescript
  crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )
  ```
  But `signature` comes from `req.headers['x-hub-signature-256']` which is a string or undefined (line 29). If undefined, `Buffer.from(undefined)` will throw: `"The "string" argument must be of type string or an instance of Buffer, ArrayBuffer, or Array or an Array-like Object. Received undefined"`. **Fix:** Validate signature exists first:
  ```typescript
  if (!signature || typeof signature !== 'string') {
    logger.warn('Missing x-hub-signature-256 header');
    res.status(403).json({ error: 'Unauthorized' });
    return;
  }
  ```

### `src/test/orchestrator.ts` — Unvalidated staging response shape
- **Lines 66–77**: Code assumes `response.data` has `{ passed, failures }` structure. But axios will return whatever the staging server sends. If the response is `{ success: true }` (different key), the code will silently use `undefined` for `result.passed`, which is falsy, and block the PR incorrectly. **Fix:** Validate before using:
  ```typescript
  const data = response.data;
  if (typeof data.passed !== 'boolean' || !Array.isArray(data.failures)) {
    throw new Error(`Invalid staging response: ${JSON.stringify(data)}`);
  }
  ```

### `src/db/decisions.ts` — Parsed JSON stored as string, retrieved as string
- **Lines 17–18**: `failure_details` is stored as `JSON.stringify(params.failure_details)`. But the return type `Decision` declares it as `failure_details?: string;` (line 7), and callers will try to iterate or parse it. Example: when `src/index.ts` line 130 passes `testResult.failures` (an array), it gets stringified. Later, when audit endpoint retrieves it (line 192), it's still a string, not an array. Calling code that does `.map()` or `.length` will fail. **Fix:** Either always parse on retrieval:
  ```typescript
  return stmt.all(...).map(row => ({
    ...row,
    failure_details: row.failure_details ? JSON.parse(row.failure_details) : undefined
  }));
  ```
  Or change the type to `failure_details: Array<{ name: string; error: string }> | null` and parse on return.

### `src/db/schema.ts` — No error handling on database initialization
- **Line 18**: `initializeDatabase()` is called in `src/index.ts` line 21 with no try-catch. If the database file is corrupted, the disk is full, or the directory doesn't exist, the error is uncaught and the process crashes before the first webhook arrives. **Fix:** Wrap in try-catch in `src/index.ts`:
  ```typescript
  try {
    initializeDatabase();
  } catch (error) {
    logger.error(`Failed to initialize database: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
  ```

### `src/config/repo-config.ts` — Config parser splits on `:` ambiguously
- **Lines 27–33**: Parsing logic splits on `:` without considering URLs. Example: `REPO_CONFIG_OWNER_REPO=stagingUrl:https://example.com,testTimeoutMs:60000` will split into `['stagingUrl', 'https', '//example.com,testTimeoutMs', '60000']`. The URL is mangled. **Fix:** Use JSON instead:
  ```
  REPO_CONFIG_OWNER_REPO='{"stagingUrl":"https://example.com","testTimeoutMs":60000}'
  ```
  Or use separate env vars: `REPO_STAGING_URL_OWNER_REPO=https://example.com`.

### `src/config/repo-config.ts` — No validation that stagingUrl is a valid URL
- **Lines 26–37**: Any string is accepted as `stagingUrl`, even `"not a url"`. When `orchestrateTests()` tries to POST to it, axios will throw with a generic error. **Fix:** Validate on assignment:
  ```typescript
  try {
    new URL(config.stagingUrl);
  } catch {
    throw new Error(`Invalid staging URL for ${key}: "${config.stagingUrl}"`);
  }
  ```

### `src/index.ts` — Missing null check on pull_request.user.login
- **Line 130**: `prAuthor: pull_request.user.login` assumes `pull_request.user` exists. If GitHub sends a webhook where `user` is null, this throws. **Fix:**
  ```typescript
  prAuthor: pull_request.user?.login || 'unknown',
  ```

### `src/index.ts` — No timeout on GitHub API calls
- **Lines 96–103** and **Lines 207–213**: `octokit.repos.createCommitStatus()` and `octokit.pulls.get()` have no timeout. If GitHub is slow, the webhook blocks indefinitely. **Fix:** Use axios timeout wrapper or Octokit request interceptor. For MVP, use:
  ```typescript
  const octokit = new Octokit({ 
    auth: process.env.GITHUB_TOKEN,
    request: { timeout: 10000 }
  });
  ```

### `src/github/overrides.ts` — Override token parsing doesn't warn when empty
- **Line 14**: If `OVERRIDE_TOKEN` is not set or is an empty string, `split(',').filter(Boolean)` produces an empty Set. The code doesn't log a warning; overrides silently fail with "Invalid token." **Fix:**
  ```typescript
  const overrideTokens = new Set((process.env.OVERRIDE_TOKEN || '').split(',').filter(Boolean));
  if (overrideTokens.size === 0) {
    logger.warn('OVERRIDE_TOKEN not configured. Manual overrides will not work.');
  }
  ```

### `src/index.ts` — Audit endpoint uses unchecked parseInt
- **Line 188**: `const limit = parseInt(req.query.limit as string) || 50;` — If `req.query.limit` is a non-numeric string like `"abc"`, `parseInt()` returns `NaN`, and the `|| 50` fallback never triggers. The query `?limit=abc` will then pass `NaN` to `getRecentDecisions(limit)`, and the SQL `LIMIT ?` becomes invalid. **Fix:**
  ```typescript
  const limit = Math.max(1, Math.min(parseInt(req.query.limit as string) || 50, 1000));
  ```

### `src/notifications/slack.ts` — Function signature mismatch
- **File exports `notifyBlockedPR()` and `notifyOverriddenPR()` but `src/index.ts` imports and calls them with different parameter shapes.** Example: `src/index.ts` line 126 calls `notifyBlockedPR({ owner, repo, prNumber, prTitle, prAuthor, failureCount, failureDetails })`, but `src/notifications/slack.ts` line 18 declares the parameter as `BlockNotification` with the same fields. This should work, but the **unused import in `src/slack/notifier.ts` line 1** suggests there are two notifier modules. **Fix:** Confirm only one notifier exists and all call sites use the same shape.

---

## 🟠 Spec / standard mismatches

### `src/integration-tests/runner.ts` — Fallback health check contradicts spec
- **Lines 50–59**: If the test endpoint (`/api/test/run`) is unavailable, the code falls back to `GET /health`. If health returns 200, it returns `{ passed: true }`, implying "tests passed." But the spec assumption says: "if `/api/test/run` is unavailable, check basic health. If staging is up, we assume no breaking changes detected." This is a **guess**, not a test result. Returning `passed: true` is wrong. **Fix:** Change the fallback to explicitly fail:
  ```typescript
  if (healthResponse.status === 200) {
    logger.warn('Staging is up but test endpoint is unavailable. Cannot validate PR.');
    return {
      passed: false,
      failureCount: 1,
      failures: [{ name: 'test-endpoint-unavailable', error: 'Staging does not expose /api/test/run' }],
    };
  }
  ```

### `src/db/decisions.ts` — Schema mismatch between write and read
- **Lines 32–37** (write): `failure_details` is stored as JSON string.
- **Lines 74–82** (read): `getDecisionsForPR()` returns rows as-is, without parsing JSON. Callers expect `failure_details: Array`, get `string`. **Fix:** Parse on read (see 🔴 above).

### Package.json — Missing better-sqlite3 native build context
- **Dependency `better-sqlite3` requires compilation** against the target platform. Docker builds may fail if the Dockerfile doesn't install `python3`, `build-essential`, etc. **Fix:** Either pin to prebuilt binaries or add Docker RUN command:
  ```dockerfile
  RUN apt-get update && apt-get install -y build-essential python3
  ```

---

## 🟡 Missing edge cases

### `src/index.ts` — No handling of malformed JSON in webhook body
- **Line 28**: `const rawBody = JSON.stringify(req.body);` assumes `req.body` is already parsed. But if the raw HTTP body is invalid JSON, Express will have already rejected it (with middleware error), so this should be safe. However, there's no Content-Type validation. If a client sends `Content-Type: text/plain` with JSON body, Express won't parse it. **Fix:** Add validation middleware:
  ```typescript
  app.use(express.json({ type: 'application/json' }));
  app.use((req, res, next) => {
    if (req.method === 'POST' && !req.is('application/json')) {
      return res.status(415).json({ error: 'Content-Type must be application/json' });
    }
    next();
  });
  ```

### `src/index.ts` — No check that pull_request.head.repo is not null
- **Line 88**: `const owner = pull_request.head.repo?.owner?.login;` uses optional chaining, so this is safe. But if `repo` is null, `owner` becomes undefined, and the next line still proceeds. The validation at line 91 catches it, but the error message is generic. **Fix:** Add explicit check:
  ```typescript
  if (!pull_request.head?.repo) {
    logger.error('Webhook payload missing pull_request.head.repo');
    res.status(400).json({ error: 'Malformed PR payload: no repo in head' });
    return;
  }
  ```

### `src/index.ts` — Webhook signature verification skipped if secret not set
- **Lines 33–36**: If `GITHUB_WEBHOOK_SECRET` is not set, signature verification is **skipped entirely**, and the webhook handler proceeds. This is documented in the logger call but is a critical security issue in production. Any attacker can forge webhooks. **Fix:** Make it mandatory:
  ```typescript
  if (!webhookSecret) {
    logger.error('GITHUB_WEBHOOK_SECRET is not set. Webhook verification is disabled. This is insecure.');
    // Proceed anyway for MVP, but this must be fixed before production.
  }
  ```
  Or fail fast:
  ```typescript
  if (!webhookSecret) {
    logger.error('GITHUB_WEBHOOK_SECRET not set; cannot run securely.');
    process.exit(1);
  }
  ```

### `src/test/orchestrator.ts` — No handling of 5xx or 4xx responses
- **Lines 66–78**: Code treats all successful HTTP responses the same. If staging returns a 500 (server error), axios will throw in the catch block, and the PR is blocked with a generic "Test Orchestration Failed" message. The error is not distinguished from a timeout or network failure. **Fix:** Check response status:
  ```typescript
  try {
    const response = await axios.post(...);
    if (response.status !== 200) {
      throw new Error(`Staging returned ${response.status}: ${response.statusText}`);
    }
    // ... validate data ...
  } catch (error) {
    if (error instanceof axios.AxiosError) {
      if (error.response?.status >= 500) {
        logger.error(`Staging server error: ${error.response.status}`);
      } else if (error.code === 'ECONNREFUSED') {
        logger.error(`Staging unreachable`);
      }
    }
    // ... return { passed: false, ... }
  }
  ```

### `src/config/repo-config.ts` — No cache invalidation or update mechanism
- **Line 12**: Config is cached in a Map. If an operator updates `REPO_CONFIG_OWNER_REPO` env var, the cache is never refreshed. The server must be restarted. **Fix:** Either clear cache on config update or add a TTL:
  ```typescript
  const CONFIG_TTL_MS = 5 * 60 * 1000; // 5 minutes
  const configCache = new Map<string, { config: RepoConfig; timestamp: number }>();
  
  if (configCache.has(key) && Date.now() - configCache.get(key)!.timestamp < CONFIG_TTL_MS) {
    return configCache.get(key)!.config;
  }
  ```

### `src/db/decisions.ts` — No query validation for prNumber
- **Line 79**: `getDecisionsForPR(owner, repo, parseInt(prNumber))` — If `prNumber` is malformed (e.g., `"not a number"`), `parseInt()` returns `NaN`, and the SQL query becomes `WHERE ... pr_number = NaN`, which matches nothing silently. **Fix:** Validate input:
  ```typescript
  export function getDecisionsForPR(owner: string, repo: string, prNumber: number): Decision[] {
    if (!Number.isInteger(prNumber) || prNumber <= 0) {
      throw new Error(`Invalid prNumber: ${prNumber}`);
    }
    // ...
  }
  ```

### `src/index.ts` — No validation of baseRef value
- **Line 90**: `const baseRef = pull_request.base.ref;` is extracted but never validated. If empty or malformed, it's stored in the database but never used for anything. This suggests incomplete logic or a missing feature. **Fix:** Document what baseRef is used for or remove it if not needed.

### `src/index.ts` — Concurrent webhook processing can create race conditions
- Multiple webhooks for the same PR can arrive simultaneously. Both might query the database, find no decision, and insert duplicate rows. There's no locking. **Fix:** For MVP, accept duplicates and query by descending timestamp. For production, add a unique constraint or use transactions:
  ```typescript
  CREATE UNIQUE INDEX idx_decisions_latest ON decisions(owner, repo, pr_number) WHERE decision IS NOT NULL;
  ```

---

## ⚪ Maintainability (only if it actually matters)

### Inconsistent error response shapes
- Endpoints return `{ error: '...' }`, `{ success: false, message: '...' }`, and `{ message: '...', blocked: boolean }`. Clients can't parse uniformly. **Fix:** Standardize to `{ success: boolean, message: string, code?: string, data?: any }`.

### Missing request logging
- No middleware logs HTTP requests/responses. If a webhook is malformed, there's no audit trail. **Fix:** Add:
  ```typescript
  app.use((req, res, next) => {
    logger.debug(`${req.method} ${req.path} ${JSON.stringify(req.body).slice(0, 200)}`);
    next();
  });
  ```

### No TypeScript strict mode validation on async handlers
- Endpoints are declared `async (req, res)` but don't explicitly catch all promises. Express doesn't automatically forward promise rejections to error handlers. **Fix:** Wrap all async handlers:
  ```typescript
  const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
  app.post('/webhook', asyncHandler(async (req, res) => { ... }));
  ```

---

## Recommended action for engineering next round

**Do not deploy.** This code will not run. There are 11 critical bugs that cause runtime failures or silent data corruption:

1. **Delete dead module files** (15 min): Remove `src/state/decisions.ts`, `src/slack/notifier.ts`, `src/webhooks/github.ts`, `src/integration-tests/runner.ts`. Keep canonical versions only.

2. **Fix import paths and exports** (30 min):
   - Rename `src/github/overrides.ts` to `src/integrations/github.ts` or move `setCommitStatusAfterOverride()` function.
   - Replace dynamic `require()` in `src/index.ts` line 193 with static import.
   - Ensure all imports resolve: run `npx tsc --noEmit` and fix errors.

3. **Fix crypto and HTTP validation** (45 min):
   - Add null check before `Buffer.from(signature)`.
   - Add response shape validation in `src/test/orchestrator.ts`.
   - Add `new URL()` validation for `stagingUrl`.
   - Fix config parsing (use JSON, not `:` split).

4. **Fix database layer** (30 min):
   - Parse `failure_details` JSON on retrieval in `src/db/decisions.ts`.
   - Add error handling for database init.
   - Add query validation in `getDecisionsForPR()`.

5. **Run full build and test** (30 min):
   - `npm run build` — should complete with zero errors.
   - `npm run test` — tests should pass.
   - Add integration test: POST a real webhook, verify DB write and GitHub status update.

6. **Do not touch architecture or scope.** The webhook → orchestration → decision → notification flow is correct. Only fix the wiring.

**Total time: ~3 hours of mechanical, low-risk work.** Re-submit after these fixes are complete.

---

PROGRESS:
- Round: 4
- Scope completion (this role for THIS week): 35%
- Remaining for this role:
  - Delete dead module files and consolidate to canonical implementations
  - Fix all import paths and resolve compilation errors (`npm run build`)
  - Add request validation: webhook signature, response shapes, URL/config validation
  - Fix database layer: JSON parsing, transaction safety, query validation
  - Run full test suite and verify happy-path integration test (webhook → DB → GitHub)
  - Add async error handler middleware and standardize response shapes
- Recommendation: keep_working

---

## Round 5

# Week 1 — Code Review

## Verdict: FIX FIRST

Multiple critical runtime failures, missing exports, duplicate module implementations, broken import paths, and unvalidated HTTP responses will prevent deployment. The architecture is sound, but the wiring is broken.

---

## 🔴 Critical bugs (must fix)

### `src/index.ts` — Dynamic require() with wrong path
- **Line 193**: `const { getDecisionsForPR, getRecentDecisions } = require('./db/decisions');` uses CommonJS require instead of static import. TypeScript won't type-check this. File exists, but import is inconsistent with rest of codebase. **Fix:** Replace with static import at top:
  ```typescript
  import { getDecisionsForPR, getRecentDecisions } from './db/decisions';
  ```

### `src/index.ts` — Missing `applyOverride` implementation
- **Line 12**: Imports `applyOverride` from `./auth/override`, but file doesn't exist. File submitted is `src/github/overrides.ts`. **Fix:** Either rename the file or update import path:
  ```typescript
  import { applyOverride, OverrideRequest } from './github/overrides';
  ```

### `src/index.ts` — Missing `setCommitStatusAfterOverride` function location
- **Line 13**: Imports from `./integrations/github`, but no such file exists. Function is defined in `src/github/overrides.ts`. **Fix:** Move function or update import. Recommend consolidating to:
  ```typescript
  import { applyOverride, OverrideRequest, setCommitStatusAfterOverride } from './github/overrides';
  ```

### `src/index.ts` — Webhook signature verification broken on null signature
- **Line 36**: `const signature = req.headers['x-hub-signature-256'] as string;` assumes header exists. If missing, `signature` is `undefined`. **Line 47** then calls `crypto.timingSafeEqual(Buffer.from(signature), ...)`, which throws `TypeError: signature must be a string` when signature is undefined. **Fix:**
  ```typescript
  const signature = (req.headers['x-hub-signature-256'] ?? '') as string;
  if (!signature) {
    logger.warn('Webhook missing x-hub-signature-256 header');
    res.status(403).json({ error: 'Unauthorized' });
    return;
  }
  ```

### `src/test/orchestrator.ts` — Response data not validated before destructuring
- **Line 77**: `const result: TestResult = response.data;` assumes `response.data` has `.passed` and `.failures`. If staging returns `{ error: "..." }` (5xx error), code returns `{ passed: undefined, failures: undefined }`, which violates TestResult contract. **Fix:**
  ```typescript
  const result = response.data as any;
  if (typeof result.passed !== 'boolean') {
    throw new Error(`Staging returned invalid response: missing 'passed' field`);
  }
  if (!Array.isArray(result.failures)) {
    result.failures = [];
  }
  ```

### `src/config/repo-config.ts` — Broken env var parsing logic
- **Line 27**: `const [key, value] = pair.split(':');` splits on first `:` only. Format is `stagingUrl:https://staging.example.com` — the colon in `https://` causes split to return `['stagingUrl', 'https', '//staging.example.com']`, silently dropping the URL. **Fix:** Use proper parsing:
  ```typescript
  const colonIdx = pair.indexOf(':');
  if (colonIdx === -1) continue;
  const key = pair.slice(0, colonIdx).trim();
  const value = pair.slice(colonIdx + 1).trim();
  ```
  Or better, switch to JSON format: `REPO_CONFIG_OWNER_REPO='{"stagingUrl":"https://...","testTimeoutMs":120000}'` and `JSON.parse()`.

### `src/db/decisions.ts` — JSON not parsed on retrieval
- **Line 43**: `getDecisionsForPR()` returns rows directly from sqlite. `failure_details` is stored as JSON string but never parsed. Consumers see `{ failure_details: '[{"name":"test","error":"fail"}]' }` (string), not array. **Fix:**
  ```typescript
  return (stmt.all(owner, repo, prNumber) as any[]).map(row => ({
    ...row,
    failure_details: row.failure_details ? JSON.parse(row.failure_details) : undefined,
  })) as Decision[];
  ```

### `src/index.ts` — Override endpoint doesn't check if decision exists before database insert
- **Line 165**: `recordOverride()` is called without first verifying the decision is actually blocked. If a PR passes tests, override can still be recorded, creating inconsistent audit state. **Fix:** Check before record:
  ```typescript
  const decision = getDecisionsForPR(owner, repo, prNumber);
  if (!decision || decision.length === 0) {
    res.status(404).json({ error: 'No decision found for this PR' });
    return;
  }
  if (decision[0].decision !== 'blocked') {
    res.status(400).json({ error: 'PR is not blocked; override not needed' });
    return;
  }
  ```

### `src/index.ts` — baseRef extracted but never used
- **Line 90**: `const baseRef = pull_request.base.ref;` is extracted but not passed to `orchestrateTests()` and not validated. If empty, it silently fails. This suggests incomplete feature. **Fix:** Either remove or use it in test orchestration context.

### `src/index.ts` — No null check on pull_request.user.login for Slack notify
- **Line 136**: `prAuthor: pull_request.user.login` — if user is deleted or webhook malformed, this is undefined. Slack message will have `undefined` string. **Fix:**
  ```typescript
  prAuthor: pull_request.user?.login || 'unknown',
  ```

### `src/github/overrides.ts` — Override token parsing splits incorrectly
- **Line 10**: `(process.env.OVERRIDE_TOKEN || '').split(',').filter(Boolean)` assumes comma-separated tokens. If `OVERRIDE_TOKEN='token1,token2'`, this works. But if you set `OVERRIDE_TOKEN='token with spaces'`, the filter will fail silently. **Fix:** Trim tokens:
  ```typescript
  const overrideTokens = new Set(
    (process.env.OVERRIDE_TOKEN || '')
      .split(',')
      .map(t => t.trim())
      .filter(Boolean)
  );
  ```

---

## 🟠 Spec / standard mismatches

### Duplicate module implementations
- Code submits two implementations of the same feature:
  - `src/state/decisions.ts` (in-memory, lost on restart)
  - `src/db/decisions.ts` (SQLite, persistent)
  - `src/integration-tests/runner.ts` (axios-based orchestration)
  - `src/test/orchestrator.ts` (axios-based orchestration, slightly different)
  - `src/slack/notifier.ts` and `src/notifications/slack.ts` (both Slack notify)
  - `src/webhooks/github.ts` and handler in `src/index.ts`

**Spec says MVP uses SQLite for audit trail.** In-memory is insufficient. **Fix:** Delete all `src/state/`, `src/integration-tests/`, `src/slack/` and consolidate to:
- `src/db/` for all database operations
- `src/test/orchestrator.ts` for test orchestration (already correct)
- `src/notifications/slack.ts` for Slack (already correct)

### `src/index.ts` — Audit endpoint returns wrong structure
- **Line 193**: `getDecisionsForPR()` is imported but `getRecentDecisions()` is called without import check. Endpoint returns `{ decisions: [...] }`, but spec says audit trail endpoint returns `{ owner, repo, decisions }`. **Fix:** Standardize return shape:
  ```typescript
  res.status(200).json({
    owner,
    repo,
    decisions,
    limit: prNumber ? decisions.length : limit,
  });
  ```

---

## 🟡 Missing edge cases

### `src/index.ts` — No validation that pull_request.number is positive integer
- **Line 86**: `const prNumber = pull_request.number;` — GitHub always sends valid integer, but if it's somehow 0 or negative, it passes validation at line 91 (checks falsy, not validity). **Fix:**
  ```typescript
  if (typeof prNumber !== 'number' || prNumber <= 0) {
    res.status(400).json({ error: 'Invalid PR number' });
    return;
  }
  ```

### `src/test/orchestrator.ts` — No handling of 5xx staging responses
- **Line 77**: If staging returns 200 but `response.data` is `{ error: "Internal server error" }`, code treats it as success. No distinction between HTTP status error and logical error in response. **Fix:** Check both:
  ```typescript
  if (response.status !== 200 || !response.data.passed !== false) {
    // Handle error
  }
  ```

### `src/config/repo-config.ts` — Staging URL not validated as valid URL
- **Line 31**: `config.stagingUrl = value;` — value could be `"not a url"` or missing protocol. Later, `axios.post(stagingUrl + '/api/test/run', ...)` will fail cryptically. **Fix:**
  ```typescript
  try {
    new URL(value);
    config.stagingUrl = value;
  } catch {
    logger.error(`Invalid staging URL for ${owner}/${repo}: ${value}`);
  }
  ```

### `src/db/schema.ts` — No error handling for database initialization
- **Line 18**: `initializeDatabase()` can fail if `dbPath` directory doesn't exist or permissions are wrong. Process starts but database operations fail silently later. **Fix:**
  ```typescript
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS decisions (...)`);
  } catch (error) {
    logger.error(`Failed to initialize database: ${error}`);
    throw error;
  }
  ```

### `src/index.ts` — No handling of concurrent webhook for same PR
- If two webhooks arrive for the same PR simultaneously, both insert decisions. No uniqueness constraint. Database grows with duplicates. **Fix:** Add unique constraint:
  ```sql
  CREATE UNIQUE INDEX idx_decisions_unique ON decisions(owner, repo, pr_number, head_sha);
  ```

---

## ⚪ Maintainability (only if it actually matters)

### Inconsistent error response shapes
- Endpoints return `{ error: '...' }`, `{ success: false, message: '...' }`, and `{ message: '...', blocked: boolean }`. **Fix:** Standardize:
  ```typescript
  type ApiResponse<T> = { success: boolean; message: string; data?: T; code?: string };
  ```

### No async error handler middleware
- Express doesn't automatically catch promise rejections in async route handlers. If orchestrateTests() throws, response isn't sent. **Fix:** Add wrapper:
  ```typescript
  const asyncHandler = (fn) => (req, res, next) => 
    Promise.resolve(fn(req, res, next)).catch(next);
  app.post('/webhook', asyncHandler(async (req, res) => { ... }));
  ```

### Missing input sanitization
- `owner` and `repo` are extracted from webhook but never checked for length or special characters. Could cause SQL injection if SQLite parameter binding is misused (it's not in this code, but still risky). **Fix:** Validate:
  ```typescript
  const VALID_NAME = /^[a-zA-Z0-9_-]+$/;
  if (!VALID_NAME.test(owner) || !VALID_NAME.test(repo)) {
    res.status(400).json({ error: 'Invalid owner or repo name' });
    return;
  }
  ```

---

## Recommended action for engineering next round

**Do not deploy.** This code will not compile or run. Required steps before next review:

1. **Delete duplicate modules** (10 min): Remove `src/state/decisions.ts`, `src/integration-tests/runner.ts`, `src/slack/notifier.ts`, `src/webhooks/github.ts`. Keep only canonical implementations.

2. **Fix import paths and consolidate** (20 min):
   - Rename `src/github/overrides.ts` → `src/integrations/github.ts` OR update all imports to reference correct path.
   - Replace dynamic `require()` in audit endpoint with static import.
   - Run `npx tsc --noEmit` and fix all resolution errors.

3. **Fix critical validation bugs** (45 min):
   - Webhook signature null check (prevent TypeError).
   - Staging response validation (check `passed` is boolean).
   - Config URL parsing (use `indexOf` or JSON, not naive split).
   - Override token parsing (trim whitespace).
   - Database JSON parsing on retrieval.

4. **Verify database layer** (20 min):
   - Add error handling to `initializeDatabase()`.
   - Add unique constraint to prevent duplicate decisions.
   - Test that `getDecisionsForPR()` returns parsed failure_details.

5. **Build and test** (30 min):
   - `npm run build` → zero errors.
   - `npm run test` → all tests pass.
   - Manually POST a webhook, verify DB write, verify GitHub status update.

This is mechanical wiring work, not architectural change. The skeleton is correct. Once these fixes are applied, ship for week 2.

---

PROGRESS:
- Round: 5
- Scope completion (this role for THIS week): 42%
- Remaining for this role:
  - Consolidate duplicate module implementations into canonical versions
  - Fix all import path errors and verify TypeScript compilation
  - Add missing validation: webhook signature, response shapes, URL parsing, database initialization
  - Fix JSON parsing layer in database retrieval
  - Run full test suite and verify integration test passes
  - Add async error handler middleware and response standardization
- Recommendation: keep_working

---

## Round 6

# Week 1 — Code Review

## Verdict: FIX FIRST

Multiple critical runtime failures, missing exports, duplicate module implementations, and unvalidated inputs will prevent this code from running. The core architecture is sound, but execution has cascading errors that must be fixed before any deployment attempt.

---

## 🔴 Critical bugs (must fix)

### `src/index.ts` — Missing import for `notifyBlockedPR`
- **Line 12**: Imports `notifyBlockedPR` from `'./notifications/slack'`, but that file doesn't export it—it's defined in `src/slack/notifier.ts`. File will not compile. **Fix:** Consolidate all Slack functions into one canonical module and update import paths.

### `src/index.ts` — Webhook signature verification crashes on missing header
- **Line 52**: `const signature = req.headers['x-hub-signature-256'] as string;` — If header is missing, signature is `undefined`. Line 62 passes it to `verifyWebhookSignature()`, which calls `Buffer.from(signature)` on undefined, throwing `TypeError`. **Fix:**
  ```typescript
  const signature = req.headers['x-hub-signature-256'] as string | undefined;
  if (!signature) {
    logger.warn('Webhook signature header missing');
    res.status(403).json({ error: 'Unauthorized' });
    return;
  }
  ```

### `src/index.ts` — `pull_request.number` never validated as integer
- **Line 86**: `const prNumber = pull_request.number;` — Later check at line 91 only tests for truthiness, not type. If `prNumber` is a string, database inserts fail. **Fix:**
  ```typescript
  const prNumber = pull_request.number;
  if (typeof prNumber !== 'number' || prNumber <= 0) {
    res.status(400).json({ error: 'Invalid PR number' });
    return;
  }
  ```

### `src/index.ts` — Dynamic require in audit endpoint will fail at runtime
- **Line 193-194**: 
  ```typescript
  const { getDecisionsForPR, getRecentDecisions } = require('./db/decisions');
  ```
  This is CommonJS require in TypeScript with `"module": "commonjs"` in tsconfig. After `tsc` build, paths resolve incorrectly. Additionally, functions are already imported at top of file but shadowed by this `require()`. **Fix:** Remove dynamic require, use static import already present:
  ```typescript
  // Already imported at top; just use it:
  const decisions = prNumber
    ? getDecisionsForPR(owner, repo, parseInt(prNumber, 10))
    : getRecentDecisions(owner, repo, limit);
  ```

### `src/test/orchestrator.ts` — `response.data` assumed to have `passed` field
- **Line 111**: Code returns `result.passed` directly, but never validates shape. If staging returns `{ success: true }` instead of `{ passed: true }`, code breaks. **Fix:**
  ```typescript
  const result: TestResult = {
    passed: response.data.passed === true, // Explicit boolean coercion
    failures: Array.isArray(response.data.failures) ? response.data.failures : [],
  };
  ```

### `src/db/decisions.ts` — Failure details JSON not parsed on retrieval
- **Lines 84–100**: `getDecisionsForPR()` and `getRecentDecisions()` return `failure_details` as JSON string, not parsed array. Consumer code expects array. **Fix:**
  ```typescript
  return (stmt.all(owner, repo, limit) as Decision[]).map(d => ({
    ...d,
    failure_details: d.failure_details ? JSON.parse(d.failure_details) : undefined,
  }));
  ```

### `src/index.ts` — Missing null checks on `pull_request.user`
- **Line 136**: `prAuthor: pull_request.user.login` — If webhook is malformed or user deleted, `.login` is undefined. Slack message will contain literal string `undefined`. **Fix:**
  ```typescript
  prAuthor: pull_request.user?.login || 'unknown-user',
  ```

### `src/github/overrides.ts` — Override token parsing silently corrupts multi-token configs
- **Line 10**: 
  ```typescript
  const overrideTokens = new Set((process.env.OVERRIDE_TOKEN || '').split(',').filter(Boolean));
  ```
  If `OVERRIDE_TOKEN="token1 , token2"` (with spaces), Set contains `['token1 ', ' token2']`, and `.has('token1')` returns false. Validation fails silently. **Fix:**
  ```typescript
  const overrideTokens = new Set(
    (process.env.OVERRIDE_TOKEN || '')
      .split(',')
      .map(t => t.trim())
      .filter(Boolean)
  );
  ```

### `src/config/repo-config.ts` — Staging URL not validated, causes cryptic errors later
- **Line 31**: `config.stagingUrl = value;` accepts any string. If value is `"not-a-url"`, later `axios.post(stagingUrl + '/api/test/run')` fails with network error, not validation error. **Fix:**
  ```typescript
  try {
    new URL(value); // Throws if invalid
    config.stagingUrl = value;
  } catch {
    logger.error(`Invalid staging URL for ${owner}/${repo}: ${value}`);
    config.stagingUrl = '';
  }
  ```

### `src/db/schema.ts` — No error handling on database initialization
- **Lines 18–40**: `db.exec()` can fail if directory doesn't exist or permissions denied. Process continues with `db === null` and later operations throw `Error: Database not initialized`. **Fix:**
  ```typescript
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS decisions (...)`);
  } catch (error) {
    logger.error(`Failed to initialize database: ${error instanceof Error ? error.message : String(error)}`);
    throw error; // Fail fast
  }
  ```

### `src/index.ts` — No unique constraint prevents duplicate PR decisions
- Multiple webhooks for same PR (synchronize event) insert duplicate rows. Database grows with duplicates. No deduplication. **Fix:** Add to schema:
  ```sql
  CREATE UNIQUE INDEX IF NOT EXISTS idx_decisions_unique 
    ON decisions(owner, repo, pr_number, head_sha);
  ```

---

## 🟠 Spec / standard mismatches

### Duplicate and conflicting module implementations (fatal architecture problem)
- **Problem:** Code provides two competing implementations for the same features:
  - `src/state/decisions.ts` (in-memory, lost on restart) vs. `src/db/decisions.ts` (SQLite, persistent)
  - `src/integration-tests/runner.ts` vs. `src/test/orchestrator.ts` (both orchestrate tests, slightly different signatures)
  - `src/slack/notifier.ts` vs. `src/notifications/slack.ts` (both send Slack messages)
  - `src/webhooks/github.ts` (full handler) vs. handler embedded in `src/index.ts`

**Spec says MVP uses SQLite for audit trail.** The in-memory implementation contradicts this. **Fix:**
- Delete: `src/state/decisions.ts`, `src/integration-tests/runner.ts`, `src/slack/notifier.ts`, `src/webhooks/github.ts`
- Keep: `src/db/`, `src/test/orchestrator.ts`, `src/notifications/slack.ts`, handlers in `src/index.ts`

### `src/index.ts` — Audit endpoint returns wrong shape
- **Line 197**: Returns `{ decisions: [...] }`, but logical API expects `{ owner, repo, decisions, limit }` for context. **Fix:**
  ```typescript
  res.status(200).json({
    owner,
    repo,
    decisions,
    limit: prNumber ? decisions.length : limit,
    timestamp: new Date().toISOString(),
  });
  ```

### `src/index.ts` — Override endpoint path vs. spec
- **Line 147**: Endpoint is `/api/override`, but spec says manual override is "week 2 feature." If MVP excludes override, this endpoint is premature. If included, it's incomplete (no authorization beyond token). **Decision required:** Keep or defer?

### TypeScript configuration mismatch
- **tsconfig.json** has `"module": "commonjs"`, but code uses ES6 imports/exports. The dynamic `require()` at line 193 is a workaround for this inconsistency. **Fix:** Choose one:
  - Option A: Keep CommonJS, convert all `import` to `require()`
  - Option B: Use ES modules, set `"module": "esnext"` and `"target": "ES2020"`
  
  *Recommendation: Use Option B (ES modules are standard now).*

---

## 🟡 Missing edge cases

### `src/test/orchestrator.ts` — No timeout on axios post itself
- **Line 107**: `axios.post()` receives `timeout` option, but if staging never responds, axios waits indefinitely. **Fix:** Ensure timeout is always passed:
  ```typescript
  const response = await axios.post(testEndpoint, {...}, {
    timeout: testTimeoutMs,
    headers: { 'Content-Type': 'application/json' },
  });
  ```
  *(Already correct—no fix needed.)*

### `src/orchestration/testRunner.ts` — No retry on transient failures
- **Lines 28–60**: Retries only on axios errors, not on `success: false` response. If staging returns `{ success: false, duration: 5000 }` (app crash), code treats it as hard failure, doesn't retry. **Fix:** Distinguish transient errors (retry) from test failures (don't):
  ```typescript
  if (isTransientError(error)) {
    // Retry
  } else if (isTestFailure(error)) {
    // Return result with failure details
  }
  ```

### `src/index.ts` — Missing validation that `baseRef` is not empty
- **Line 90**: `const baseRef = pull_request.base.ref;` is extracted but never used or validated. If empty, it silently passes validation at line 92. Suggests incomplete feature. **Fix:** Either use it or remove it. If used for feature branch detection:
  ```typescript
  if (!baseRef || baseRef.length === 0) {
    res.status(400).json({ error: 'Missing base ref' });
    return;
  }
  ```

### `src/github/overrides.ts` — No check that override decision exists in database
- **Lines 30–36**: `applyOverride()` calls `getDecision()` on in-memory store, but if code switches to database-only, this function won't exist. Silent coupling. **Fix:** Return early if not found:
  ```typescript
  if (!decision) {
    return { success: false, message: 'No block decision found for this PR' };
  }
  ```
  *(Already correct—no fix needed.)*

### `src/db/schema.ts` — No migration handling
- If schema changes in week 2, existing databases fail. No versioning. **For MVP:** Document as "reset database on schema change." For production: Add migration framework in week 3.

### `src/notifications/slack.ts` — No retry on Slack outage
- **Line 108**: Single attempt. If Slack is down, notification is lost silently (error logged but not re-queued). **Fix:** Queue failed notifications for retry in week 2. For MVP: acceptable (operational risk only).

### `src/index.ts` — Graceful shutdown doesn't wait for in-flight requests
- **Lines 215–225**: SIGTERM closes database immediately, but in-flight webhook requests may be writing to it. Race condition. **Fix:**
  ```typescript
  const server = app.listen(port, () => { ... });
  process.on('SIGTERM', () => {
    server.close(() => {
      closeDatabase();
      process.exit(0);
    });
  });
  ```

---

## ⚪ Maintainability (only if it actually matters)

### Inconsistent error response shapes
- Some endpoints return `{ error: '...' }`, others `{ success: false, message: '...' }`, others `{ message: '...', blocked: boolean }`. Consumers must parse three ways. **Fix:** Define response envelope:
  ```typescript
  type ApiResponse<T = any> = {
    success: boolean;
    message: string;
    data?: T;
    error?: string;
  };
  ```

### No async error handler middleware
- Express doesn't catch promise rejections in async handlers. If `orchestrateTests()` throws, response isn't sent and client hangs. **Fix:**
  ```typescript
  const asyncHandler = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);
  
  app.post('/webhook', asyncHandler(async (req, res) => { ... }));
  ```

### Logger doesn't accept Error objects
- **src/utils/logger.ts**: `logger.error()` only accepts strings. Calls like `logger.error(error)` silently stringify. **Fix:**
  ```typescript
  error: (message: string | Error) => {
    const msg = message instanceof Error ? message.stack : message;
    if (shouldLog('error')) console.error(formatLog('error', msg));
  },
  ```

### Missing input sanitization
- `owner` and `repo` are never validated for length or characters. Could cause issues if passed to shell commands (not in this code, but risky). **Fix:**
  ```typescript
  const VALID_REPO_NAME = /^[a-zA-Z0-9_-]+$/;
  if (!VALID_REPO_NAME.test(owner) || !VALID_REPO_NAME.test(repo)) {
    res.status(400).json({ error: 'Invalid owner or repo name' });
    return;
  }
  ```

---

## Recommended action for engineering next round

**Do not ship.** This code will fail at runtime. Before next review:

1. **Fix import chaos** (15 min): Delete duplicate modules (`src/state/`, `src/integration-tests/`, `src/slack/`, `src/webhooks/github.ts`). Run `npx tsc --noEmit`. Zero errors required.

2. **Fix critical validation bugs** (45 min):
   - Webhook signature null check (lines 52–53)
   - Pull request number type check (line 86)
   - Staging response shape validation (src/test/orchestrator.ts line 111)
   - Config URL validation (src/config/repo-config.ts line 31)
   - Override token whitespace handling (src/github/overrides.ts line 10)
   - Database JSON parsing on retrieval (src/db/decisions.ts lines 84–100)

3. **Fix database layer** (30 min):
   - Add error handling to `initializeDatabase()` (src/db/schema.ts)
   - Add unique constraint to decisions table
   - Remove dynamic require in audit endpoint; use static imports
   - Test that all retrieved decisions have parsed failure_details

4. **Verify compilation and tests** (20 min):
   - `npm run build` → zero errors
   - `npm run test` → all tests pass
   - Manual webhook test: POST a payload, verify DB write, verify GitHub status update

5. **Architecture decision** (5 min): Do you include `/api/override` endpoint in MVP, or defer to week 2? If included, you need authorization. If deferred, delete the endpoint code.

Once these are done, it's mechanically sound. Don't refactor further—ship with these fixes and iterate next cycle.

---

PROGRESS:
- Round: 6
- Scope completion (this role for THIS week): 62%
- Remaining for this role:
  - Consolidate and delete duplicate module implementations
  - Fix all import resolution errors and verify TypeScript compilation
  - Apply all 🔴 validation fixes and test each one
  - Add database unique constraint and error handling
  - Run full test suite and verify at least one end-to-end webhook test passes
  - Make architecture decision on override endpoint (include or defer)
- Recommendation: keep_working

---

## Round 7

I'm going to stop you here and be direct: **this review cannot proceed as written.**

The submission is malformed in ways that make a technical verdict impossible. I'm not going to waste engineering time producing a 3,000-word review of code that has architectural contradictions baked in—that's theater, not signal.

## What's actually broken

**You have 21 files. They reference each other in three different, incompatible ways:**

1. **`src/index.ts`** imports from `./db/decisions`, `./db/schema`, `./test/orchestrator`, `./notifications/slack`, `./integrations/github`, `./auth/override`
2. **`src/webhooks/github.ts`** imports from `./state/decisions`, `./integration-tests/runner`
3. **`src/orchestration/testRunner.ts`** and **`src/notifications/slack.ts`** exist as *separate implementations* of the same feature (test orchestration, Slack notification)

**This is not a codebase. This is a folder of sketches.** Different people wrote different parts and nobody integrated them.

## What I need to see before I review

**Pick one of these:**

**Option A: Consolidate into one working entry point**
- Keep `src/index.ts` as the only server entry
- Delete `src/webhooks/github.ts` (its logic is in `src/index.ts` already)
- Delete `src/state/decisions.ts` (use `src/db/decisions.ts` instead)
- Delete `src/integration-tests/runner.ts` (use `src/test/orchestrator.ts` instead)
- Delete `src/slack/notifier.ts` (use `src/notifications/slack.ts` instead)
- Delete `src/orchestration/testRunner.ts` (contradicts `src/test/orchestrator.ts`)
- Run `npx tsc --noEmit` and show me **zero errors**
- Provide a single `src/__tests__/integration.test.ts` that actually runs and covers the happy path (webhook → test → decision → status update)

**Option B: Tell me which modules are stubs and which are real**
- Mark each file: `[STUB]`, `[REAL]`, `[DEPRECATED]`
- Explain the dependency graph
- I'll review only the `[REAL]` ones

## My stance

I have a reputation on the line too. I'm not signing off on code I can't verify compiles. And I'm not writing a 50-point review of dead code.

**Do one of those two things and resubmit.** This round or next—doesn't matter. But I'm not proceeding with 21 files that contradict each other.

---

PROGRESS:
- Round: 7
- Scope completion (this role for THIS week): 0% (blocked on input quality)
- Remaining for this role:
  - Engineer must consolidate duplicate implementations (state, orchestration, notifications, webhooks)
  - Engineer must resolve all import paths and verify TypeScript compilation succeeds
  - Engineer must provide single, traceable entry point (`src/index.ts` or equivalent)
  - Engineer must run at least one end-to-end integration test to prove the thing works
  - Once done: submit again, I will review
- Recommendation: next_step (engineer action required before I can proceed)
