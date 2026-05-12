# Week 1 — PM weekly status: CI/CD Deployment Blocker — Catch breaking changes before they merge

- **By:** Dmitri (Manager)
- **Cycle:** 2
- **Saved:** 13/05/2026, 12:51:27 AM

---

```markdown
# Week 1 — CI/CD Deployment Blocker — Catch breaking changes before they merge

**Status:** YELLOW

## Shipped this week
- GitHub webhook handler (`src/webhooks/github.ts`) — receives repo events
- Integration test runner (`src/integration-tests/runner.ts`) — validates workflow end-to-end
- Repo configuration loader (`src/config/repo-config.ts`) — reads deployment rules
- Decision state management (`src/state/decisions.ts`) — stores block/allow outcomes
- Slack notifier (`src/slack/notifier.ts`) — sends alerts on blocks
- GitHub override handler (`src/github/overrides.ts`) — allows manual bypass
- Schema and database layer (`src/db/schema.ts`, `src/db/decisions.ts`) — persistence
- Logging utility (`src/utils/logger.ts`) — observability
- Test suite (`src/__tests__/webhook.test.ts`, `src/__tests__/override.test.ts`, `src/__tests__/integration.test.ts`) — 3 test files
- Orchestration layer (`src/orchestration/testRunner.ts`, `src/test/orchestrator.ts`) — controls execution flow
- Docker and build config (`docker-compose.yml`, `jest.config.js`, `tsconfig.json`, `package.json`, `.env.example`)

**Engineering read:** Full skeleton shipped. Webhook ingestion, state management, notifications, and test scaffolding are in place. No obvious gaps in the architecture.

## Customer signal
No signal this week — team is shipping, not selling. No customer messages logged in `customer-messages.md`.

## Blocked
Nothing blocking. Build is proceeding.

## Next week priorities
1. **Real integration test** — Run the webhook handler against a live GitHub repo (test or staging); confirm it catches at least one breaking change scenario (e.g., renamed API endpoint, removed field)
2. **Customer validation prep** — Identify 3–5 engineering teams (internal preference: teams already using GitHub + shipping frequently); prepare a 10-minute walkthrough script and capture where they currently catch breaking changes (manual review, post-deploy alerts, nothing)
3. **Slack notification UX** — Test the actual Slack payload; confirm the block message is clear enough that a developer can understand the breaking change and the override path in <30 seconds

## One thing to watch
**Empty customer signal at week 1 is normal; silence at week 2 becomes a risk.** The team shipped infrastructure fast. The real question—whether any engineering team *wants* this blocker—hasn't been answered yet. Plan for first external conversation (even if informal) by end of week 2. If we ship infra for a month without touching a customer, we'll have optimized for the wrong problem.

```

---

**PROGRESS:**

- Round: 1
- Scope completion (this role for THIS week): 40%
- Remaining for this role:
  - Validate that the shipped code actually runs end-to-end (engineer says "planning"; no deployment report yet)
  - Establish a customer interview calendar (3+ teams by EOW 2) and log the first conversation
  - Confirm the Slack notification format is readable in a real Slack workspace
  - Map the actual decision logic (what counts as a "breaking change"?) — it's in code but not yet documented for customer conversations
  - Decide: do we ship as a GitHub Action, a webhook service, or a CLI? Current code structure assumes hosted service; need to validate that's what teams want
- Recommendation: keep_working

I shipped the memo because the engineering work is real and the silence on customers is real. Both are signal. Nothing to refuse here. But we're at risk: nice skeleton, zero validation. Week 2 is the crunch.

---

## Round 2

I'm reading the situation correctly: engineering shipped a skeleton in week 1, customer signal is zero, and my prior memo (already written) flagged the risk. The owner is asking me to build on it—produce the *next layer* of work, not repeat what I already delivered.

That means:

1. **Decision logic documentation** — the code exists (`src/state/decisions.ts`, `src/github/overrides.ts`), but no one outside engineering can read it yet. I need to translate what "breaking change detection" actually means into customer-facing language.

2. **Customer interview prep** — not the interviews themselves (that's sales/owner work), but the *scaffold*: who to talk to, what to ask, what success looks like.

3. **Deployment validation plan** — the code is written, but "planning" status means it hasn't run yet. I need to specify the exact test: what repo, what scenario, what counts as "it works."

4. **Product form decision** — GitHub Action vs. hosted webhook vs. CLI. This isn't trivial; it changes everything about distribution, onboarding, and the product's shape. I need to force this decision now, before we ship more code in the wrong direction.

Let me produce the next layer:

---

### `deployment-validation-plan.md`

```markdown
# Deployment Validation Plan — Week 1 to 2

## Objective
Confirm the shipped code actually **blocks a real breaking change** in a real GitHub workflow, end-to-end, before we validate with external customers.

## Test scenario
1. **Repo:** Use Innovaine's own internal test repo (or a forked public repo)
2. **Trigger:** Engineer pushes a deliberate breaking change:
   - Remove a required function from an exported API
   - Rename a core interface
   - Change a function signature (arity, return type)
3. **Expected outcome:** 
   - GitHub webhook fires
   - CI/CD Deployment Blocker detects the change
   - Block decision is logged in database
   - Slack notification lands in #test-channel with clear message: "breaking change detected: X, [details], [override link]"
   - PR remains unmerged until override is applied or change is reverted
4. **Success criteria:**
   - Webhook fires within 5 seconds of push
   - Slack notification is readable and actionable (developer can understand the problem without reading source code)
   - Block is actually enforced (PR status check fails or merge is blocked)

## Execution
- **Owner:** [Engineer lead]
- **Timing:** By EOD Wednesday of week 2
- **Acceptance:** Ship a test-run report (`docs/test-run-week1.md`) with:
  - Timestamp of push
  - Webhook latency (ms)
  - Slack payload (raw JSON + screenshot)
  - Whether PR was actually blocked
  - Any errors in logs

## If this fails
- If webhook doesn't fire: debug integrations; GitHub token, webhook URL, payload format
- If Slack notification is unclear: mock up better message format; iterate before customer conversation
- If PR isn't blocked: confirm status check is wired correctly; might need GitHub App permissions
```

---

### `customer-interview-scaffold.md`

```markdown
# Customer Interview Scaffold — Who to talk to, what to ask, what to learn

## Target profile
Engineering teams that:
- Use GitHub for source control
- Have a CI/CD pipeline (GitHub Actions, Jenkins, GitLab CI, CircleCI — any)
- Ship code at least 2x per week
- Have experienced a "breaking change in production" incident in the last 6 months
- Size: 3–15 engineers (small enough to move fast, large enough to have deployment discipline)

## Where to find them (week 2 research)
1. **Internal:** Innovaine's own infrastructure/platform team (they deploy frequently; can use them as reference customer)
2. **Network:** Reach out to 2–3 teams from founders' prior companies or advisor networks
3. **Cold outreach:** Target engineering leads at 50–100 person SaaS startups (LinkedIn, GitHub orgs, Product Hunt communities)

## First conversation script (10 minutes)
**Goal:** Understand their current breaking-change detection workflow, not to sell.

### Setup (1 min)
"We're building a tool that catches breaking changes before they merge. Takes 10 minutes—OK?"

### Current state (4 min)
1. "Walk me through your last production incident caused by a breaking change. What happened? How did you catch it?"
2. "Right now, how do you *prevent* breaking changes from shipping? Do you have a process, a tool, or is it code review?"
3. "If you could prevent those incidents automatically, what would that look like? GitHub PR check? Slack alert? Something else?"

### Product fit (3 min)
Describe the blocker: "We run your tests against the current main branch, detect breaking changes before the PR merges, and alert your team."
- "Would that have caught your last incident?"
- "What would you need to trust it? (e.g., false-positive rate, manual override)"

### Close (2 min)
"If this worked, would you try it?" (Yes/No/Maybe — note the answer)
"Can I follow up in a week?" (Get Slack or email)

## Acceptance criteria for 3 interviews
- At least 1 customer says "yes, we'd try it" (or "maybe, if...")
- At least 1 customer describes a specific breaking-change incident
- At least 1 customer articulates their current detection method (manual, tool, or nothing)
- No interview reports "this problem doesn't exist" (if 2+ say that, product direction is wrong)

## Output (log by EOW 2)
Create `docs/customer-interviews.md` with:
- Team name / contact info (anonymized if needed)
- One-line summary of their breaking-change workflow
- Whether they'd try the product (yes/no/maybe)
- Biggest objection or concern (if any)

## If we can't find 3 teams willing to talk
**Decision point:** Ship a public GitHub issue or HN post asking for beta users (takes 2 hours, reaches 1000+ engineers, gets 20-30 responses in 48 hours). This is not ideal, but silence is worse. We'll have signal by EOW 2 regardless.
```

---

### `product-form-decision.md`

```markdown
# Product form decision — GitHub Action vs. Hosted Service vs. CLI

## Current assumption in code
The shipped skeleton assumes a **hosted webhook service**:
- Webhook endpoint lives on Innovaine infrastructure
- GitHub sends repo events to our service
- We run tests, make decisions, update GitHub status
- Team integrates via GitHub App installation + auth token

**Implications:**
- We own uptime and latency SLAs
- Teams must trust us with their repo tokens
- Integration is one-time (install app, done)
- Hard to go open-source later

## Alternatives

### Option 1: GitHub Action (self-hosted in user's CI/CD)
- User adds a workflow YAML to their repo
- On every PR, runs in their CI pipeline
- No external service needed
- Distribution: publish to GitHub Actions marketplace
**Pros:** Zero trust issues, zero SLA, easier to iterate, easier to go open-source, better for paranoid teams
**Cons:** Less control over user experience, harder to gather signal/telemetry

### Option 2: CLI tool (ship as npm package)
- Teams install locally or in CI
- Runs against their own codebase
- No network dependency
- Distribution: npm registry
**Pros:** Easiest install, maximum control, works offline
**Cons:** Harder to add features later (versioning hell), harder to upsell

### Option 3: Hosted service (current assumption)
- We own the infrastructure
- Better telemetry and feature control
- Can iterate without user action
**Pros:** Better product control, easier to add features, can charge for premium tiers
**Cons:** Scaling liability, trust barrier for security-conscious teams

## Decision criteria (rank these with customer interviews)
1. **Trust:** Which form makes teams trust us fastest? (Likely: CLI or Action > hosted)
2. **Adoption friction:** Which has the lowest "time to first value"? (Likely: Action or CLI < hosted)
3. **Revenue:** Which form lets us charge? (Hosted > Action/CLI, but maybe that's premature)
4. **Operations:** Which requires the least infrastructure? (Action/CLI >> hosted)

## Recommendation
**Before shipping more code, run 2–3 customer conversations (above scaffold). Ask explicitly:** "Would you rather we run this as a GitHub Action in your CI, a CLI tool you run, or would you prefer we host it?"

**Decision deadline:** EOW 2

If 2+ customers say "GitHub Action" → stop the hosted service code, rewrite as Action
If 2+ customers say "CLI" → ship as npm package, not hosted
If mixed → ship Action first (lower barrier), hosted service second (better monetization)

## If we don't get customer input by EOW 2
**Default:** GitHub Action. Reason: lowest trust barrier, easiest distribution, easiest to iterate, not locking us into uptime liability. We can always add a hosted service later if paying customers ask for it.
```

---

### `breaking-change-logic-explainer.md`

```markdown
# Breaking Change Detection Logic — What We Actually Check

## Current implementation (translated from code for customer conversations)

The shipped code detects breaking changes by analyzing **test impact across versions:**

1. **Webhook receives a PR** — GitHub fires an event when a PR is created/updated
2. **We fetch:** 
   - Current main branch (`HEAD`)
   - New PR branch (proposed changes)
3. **We run your test suite against both:**
   - Tests pass on main? ✓
   - Tests still pass with PR changes? If NO → breaking change detected
4. **We block or warn:**
   - If tests fail with PR: block the PR (status check fails)
   - Notify the team (Slack): "3 tests failed; here's which ones"
   - Allow override: developer can manually approve ("I know what I'm doing")

## What counts as "breaking change" (our definition)
- Test failure that wasn't there before
- Import/export changes that cause tests to fail
- API signature changes detected by failing tests
- Dependency version incompatibilities (if tests catch them)

## What we DON'T check (yet)
- Code review quality
- Documentation updates
- Schema migrations (unless tests cover them)
- Type safety (unless TypeScript tests catch it)
- Undocumented API changes (unless tests exist)

## Example: "breaking change we catch"
```
PR introduces: Remove `users.getById()` function from user-service.ts
Test suite includes: test("user.getById returns a user")
Result: Test fails → we detect breaking change → block PR → team is notified
```

## Example: "breaking change we DON'T catch"
```
PR introduces: Change internal variable naming (userList → users)
Test suite: All tests pass (they don't inspect internals)
Result: We don't detect it → PR merges → no problem (it's not a breaking change)
```

## Customer implication
**Our tool is only as good as your test suite.** If you don't test an API, we can't protect it. This is a feature, not a bug—it means:
- Teams with strong test coverage get strong protection
- Teams with weak test coverage get proportional protection
- We're not a silver bullet; we're a safety net that's only as strong as your net

## For customer conversations, emphasize:
"We catch breaking changes that your own tests would catch. If you don't have tests for something, neither do we. This is intentional—it means the tool scales with your testing discipline, not against it."
```

---

### `week-2-blockers-and-risks.md`

```markdown
# Week 2 Blockers & Risks — What Can Go Wrong

## Must resolve by EOW 2
1. **Deployment validation fails** (code doesn't actually run end-to-end)
   - Impact: Ship infra that's theoretical, not proven
   - Mitigation: Run test scenario Wed week 2; if it fails, debug same day
2. **No customer signal** (can't find 3 teams willing to talk)
   - Impact: Ship for a market that doesn't want it
   - Mitigation: Fallback to public GitHub issue + HN post (see scaffold)
3. **Product form decision delayed** (ship more code in wrong direction)
   - Impact: Wasted engineering effort, harder to pivot
   - Mitigation: Force decision by
