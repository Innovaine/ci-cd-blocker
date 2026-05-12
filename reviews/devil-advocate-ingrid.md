# Devil's Advocate review: "CI/CD Deployment Blocker — Catch breaking changes before they merge"

- **By:** Ingrid (Devil's Advocate)
- **Cycle:** 1
- **Saved:** 13/05/2026, 12:35:27 AM

---

# Why This Fails

**1. The strongest reason: You're selling a tax on process that customers will work around instead of pay for.**

A blocking bot only has power if teams actually respect the block. But here's what happens in real execution: The first time your bot catches a real staging issue at 4 PM on Friday before a critical hotfix, the engineering lead overrides it, deploys anyway, and the override works fine. The bot was right that time, but the team already has muscle memory for "hit override when we're confident." Eighteen deploys later, it's just a confirmation dialog they click through. You've become a feature-blocker that trains teams to ignore your warnings. They'll churn because they either build custom exception policies (you can't support that at pre-revenue scale) or they get tired of the false-positive tax.

The paying mechanism breaks the moment they feel smart enough to skip it.

**2. The unspoken assumption: "Our integration tests are good enough to trust."**

You're assuming customer test suites are comprehensive enough that a staging run would actually catch production-grade problems. That's almost never true. Most teams have spotty integration test coverage. Half their staging failures are flaky tests that pass on retry. Your bot will either:
- Flag noise constantly (they disable alerts, churn)
- Miss the real problems because the tests don't exist (they blame you for false security, churn)

You're not selling confidence; you're selling a mirror held up to their testing discipline. Teams with *good* tests don't need you. Teams with *bad* tests won't fix them because of your bot — they'll just override and keep shipping.

**3. The competitor who crushes us quietly: Snyk, Dependabot, and the shift toward dependency-scanning-as-CI-default.**

GitHub Actions now includes native dependency vulnerability scanning. GitLab has merge request intelligence built into the platform. Both are moving toward "catch breaking changes in the dependency graph" as a platform feature, not a third-party addon. We'd be integrating staging test visibility *after* those platforms have already made breaking-change detection a commodity expectation inside CI. 

In 18 months, GitHub Actions will have its own "run tests against production environment state" template. We'll be explaining why teams should add *another* bot to their pipeline when the platform vendor is doing it for free.

**4. The market shift that makes us irrelevant: Shift-left is ending. Shift-right is winning.**

The industry is pivoting from "catch problems before production" to "catch problems in production with instant rollback." Datadog's profiling, Honeycomb's observability, LaunchDarkly's feature flags — the money is moving toward teams that can *deploy fast and revert faster* instead of teams that build more gates upstream. 

A blocking bot is a classic "prevent the problem" play. Market is paying for "detect and recover from the problem." Your timing is fighting the tide. In 18 months, teams will measure success not by "how many merges did we block" but by "how fast did we recover." Your value prop becomes a liability.

---

## What I actually think we should do:

**If the pain is real**, the wedge isn't the blocker—it's the *visibility into why staging broke when CI passed*. Build a lightweight forensics tool, not a gate. 

Ship something that:
- Intercepts test failures (staging vs. CI) 
- Diffs the environments and flags what changed between them
- Charges $50/month for the first three teams who'll let us attach to their test runs

Let teams *decide* whether to block. Give them the signal. You don't need to be the bouncer; be the person who tells them the bouncer is there.

Three weeks, GitHub/GitLab integration, charge for data access (not gates). If they find enough value in the visibility, *then* they'll ask for blocking. You'll have paying customers first and a product question second—not the reverse.
