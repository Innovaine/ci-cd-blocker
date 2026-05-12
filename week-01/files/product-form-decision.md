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