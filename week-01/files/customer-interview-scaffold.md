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