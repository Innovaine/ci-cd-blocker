# CTO review: "CI/CD Deployment Blocker — Catch breaking changes before they merge"

- **By:** Vladimir (CTO)
- **Cycle:** 1
- **Saved:** 13/05/2026, 12:34:09 AM

---

# TECHNICAL FEASIBILITY REVIEW — CI/CD DEPLOYMENT BLOCKER

## BUILD COMPLEXITY & TIMELINE

**Ugly 7-day target: GitHub + GitLab integration, single test-runner hook, hardcoded staging detection, no UI beyond bot comments.**

**Breakdown:**
- **Days 1-2:** GitHub Actions webhook + basic test-result parsing. Hardcode staging environment detection (ENV var matching, not discovery). No auth beyond GitHub token. ~400 lines.
- **Days 3-4:** GitLab integration (same webhook pattern, copy-paste 80% of GitHub code). Accept duplication.
- **Days 5-6:** Test-failure blocking logic + merge gate. Hardcode three rule sets (schema change detection via test name regex, API contract via keyword matching in failure logs, dependency conflict via npm/pip lock file diff). Rules are static strings. No ML, no learning, no dynamic rule generation.
- **Day 7:** Documentation, one customer test, deploy to prod.

**What we DON'T build in 7 days:**
- UI dashboard. Comments in PRs are our UI.
- Rule builder. Hardcoded.
- Audit logs or rollback tracking. Logs go to stdout.
- Multi-repo support. One repo per bot instance.
- Webhook signature verification (accept the risk for 7 days).
- Rate limiting or queuing. Direct calls.
- Bitbucket. Three platforms is already stretching.

**Lines of actual shipped code: ~1,200-1,400. Framework boilerplate doesn't count.**

---

## TEAM & SKILLS NEEDED

**Two people. Non-negotiable.**

1. **Mid-level backend engineer (3-5 years production experience).** Not you, Vladimir—you review, you don't code this. Someone who has shipped webhook handlers before, not afraid of copy-paste, moves fast. Can implement GitHub + GitLab webhook handlers and test-runner integration without overthinking. If we have someone who's done Slack bot integrations, they move 40% faster on this shape of work.

2. **One engineer (any seniority, 2+ years minimum) for environment detection + rule logic + one customer integration test.** This is not glamorous work—it's regex matching, environment variable parsing, and test log grepping. But it's where the actual value lives. They need to be comfortable with "this will be replaced," not attached to elegance.

**Why not one person:** Webhook handler work and rule logic can parallelize. One person blocks on debugging webhook timeouts while the other is stuck on rule testing. Two people finish in 7 days; one person takes 12.

**Who specifically:** If we have them—name them now. If not, we're not shipping in 7 days; we're shipping in 10-12.

---

## BIGGEST TECHNICAL RISK THAT KILLS US IN PRODUCTION

**Webhook delivery guarantees.** GitHub + GitLab do not guarantee webhook delivery on first attempt. If a webhook times out or our handler crashes mid-request, the merge can proceed without the bot ever seeing it. We then fail to block a breaking change, customer sees it in prod, loses trust, churns.

**Mitigation (non-negotiable):**
- Webhook handler must return HTTP 200 to GitHub/GitLab **before we do any heavy lifting.** Queue the actual test-checking work to a simple in-memory queue (not RabbitMQ—no new infra). If we crash mid-check, we lose the signal for that PR, but we don't create false negatives.
- For 7-day ship: accept that we might miss 2-3% of PRs in early days. Better to miss a check and get customer feedback than to guarantee false positives and block all deploys.
- **Hard requirement:** If staging environment is unreachable, the bot must FAIL SAFE (allow merge with a logged warning). Do not block deploys because our integration died.

**Secondary risk:** Staging environment drifts from prod. Customer runs tests against stale staging, bot says "safe," prod fails anyway. 
- **Mitigation:** We have no solution for this in 7 days. Document it in setup docs: "This catches integration breakage only if your staging is within 24 hours of prod. Older staging = blind spots." Real customers will tell us this matters; then we build solution.

**Tertiary risk (acceptable):** Test runner timeout or hanging test. Bot waits 15 minutes for test results, PR author rage-quits and force-pushes. 
- **Mitigation:** Hardcode 10-minute timeout. If tests don't finish, log it and allow merge. Customer can tune in config later.

---

## THREE FEATURES TO CUT

### **1. "Override and rollback plan" button (KILL THIS)**

**Why:** This is a feature-creep trap. It sounds like safety; it's actually a UI and state-management nightmare. "One-click rollback plan" means:
- We need to store merge state somewhere.
- We need to track which overrides happened.
- We need to generate a rollback playbook (which requires knowing customer's deployment infra, which we don't).
- Customer clicks "rollback plan," gets a PDF or email, doesn't read it, deploys anyway, fails anyway.

**Reality:** After the bot blocks a merge, the engineer either (a) fixes the test, (b) investigates why the test is wrong, or (c) pushes back to staging and retests. They don't need a pre-generated rollback plan at merge time. They need it *after* the deploy fails in prod—and that's a different product.

**Alternative:** Ship "allow merge with warning" as a manual override (engineer comment-triggers a bypass, we log it). No plan, no state, no magic. That's 20 lines of code.

**Ship instead:** Comment-based override: `@bot override-merge` in a PR comment triggers allowlist for that PR. Logged to stdout. Done.

---

### **2. Pre-built rule library (REDUCE to 3, KILL expansion)**

**Why:** We want to ship with "pre-built rules for common breaking patterns." That sounds good. It's a trap.

Every team's schema change looks different. Every API contract is different. Pre-built rules either:
- Don't match real customer failures (useless), or
- Are so generic they create false positives (blocking every deploy, customer disables bot).

**Reality:** The actual value is the **framework to detect and block**. The rules are customer-specific signals. 

**What we actually hardcode:**
1. **Test failure on staging + pass on CI** = always block. (Detects: new dependency conflicts, schema migrations, environment vars.)
2. **Specific keyword matching** (customer provides keywords in setup; we pattern-match in test output): "schema change", "migration", "contract". Hardcoded regex.
3. **Dependency lock-file diff** (simple file comparison, no semantic versioning).

**That's it. Three rules. 80% of the pain.**

**Ship instead:** One rule: "If test passed in CI but failed against staging, block the merge and ask engineer to investigate." Let the customer run the same test suite against staging. Let the failure patterns teach *them* what matters. We iterate rules based on real data.

---

### **3. Multi-environment support (KILL THIS)**

**Why:** The pitch says "hooks into existing test runners." Sounds platform-agnostic. 

In reality: Do you support `npm test`? `pytest`? `go test`? `gradle build`? Gradle with custom profiles? Docker Compose? Kubernetes jobs? Each one is a different parsing problem and a different integration.

We can't ship a 7-day MVP that works with all of them.

**What we hardcode instead:**
- **GitHub Actions + GitLab CI native integration only.** We read CI output directly from the platform's API. No custom test runner parsing.
- Customer's test suite runs in their normal CI (GitHub Actions or GitLab CI). We don't invoke tests; we read their results.
- Staging environment detection: hardcode. Customer sets `STAGING_URL` in their repo secrets. Done.

**Ship instead:** GitHub Actions + GitLab CI native integrations only. No Jenkins, no CircleCI, no custom runners, not yet. Real customers will ask for it; we charge more for it when we ship it.

---

## HARD DECISIONS

**Shipping in 7 days means:**
- No dashboard. PR comments are the UX.
- No custom rule builder. Customers email us rule requests; we hardcode them.
- No audit log. We log to stdout. If customer needs audit history, that's a $500/mo upgrade when we're at $1M ARR.
- No Bitbucket. GitHub + GitLab only.
- No Slack notifications. If the merge is blocked, it's in the PR. Customer can set up their own IFTTT if they want Slack noise.

**What stays:**
- Bot blocks merge when staging test fails.
- One-click "run tests again" (bot re-checks).
- Comment-based override (manual allowlist).
- Three hardcoded rule detections.
- GitHub + GitLab.

**Go/no-go:** Can we get two engineers with this focus for 7 days with zero context switches? If yes, this ships. If they're split across another project, add 4 days minimum.

What's the team composition right now? Do we have the two people?
