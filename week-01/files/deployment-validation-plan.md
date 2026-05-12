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