# Week 1 — Validation Protocol for "CI/CD Deployment Blocker"

**Purpose:** Determine whether breaking-change detection is a *real problem* or a *nice-to-have* before we commit 4 weeks of runway.

## The One Conversation (Due: Thursday EOD)

**Target:** One engineer at a company running >5 deployments/week. Not a CTO, not a hiring manager — a person who actually owns a deploy pipeline.

**How to find them:**
- Check Slack communities: DevOps, SRE channels in relevant communities
- Ask: "Who's deployed code to production in the last 48 hours?"
- Offer nothing. Ask for 20 minutes.

**The Script (exact words matter):**

1. "We're exploring a tool that catches breaking changes before code merges. Have you ever had a breaking change slip past your review and hit production?"

2. If YES: "How often? What happened? How long did it take to recover?"

3. If NO: "How do you currently prevent that? What does that process look like?"

4. Regardless of answer: "If a tool automatically flagged breaking changes in the PR, would your team use it?"

5. Listen for the reason code breaks escape today. Record it verbatim.

**What kills this conversation:**
- We ask a hypothetical ("would you use a tool that...?") before we know if the problem exists
- We pitch instead of listen
- We talk to someone who doesn't actually deploy code

**Red signals (stop and pivot):**
- "We've never had that problem"
- "Staging catches it"
- "Our code review process is strict enough"
- "We'd rather not add another check to the pipeline"

**Green signals (continue):**
- "We had three incidents last quarter from this"
- "It costs us 4–6 hours per incident"
- "We don't have a good way to prevent it today"
- "I'd test a tool like that immediately"

**Output by Friday 5pm:**
- Name of person interviewed
- Company/team size
- Their exact answer to "How often do breaking changes escape?"
- One sentence: "This is a real problem" or "This is not a real problem"

If we can't complete this by Friday, we pause the blocker build until we do.

---

## Why This Matters

Risk #5 in the register flags the core DNA problem: we built Deploy Guard on an assumption. It failed. We're now proposing to build a narrower version of the same assumption without validating it again.

One conversation changes that. It answers:
- Is the problem *frequent* (monthly) or *rare* (once a year)?
- Is it *painful* (costs real time/money) or *annoying* (embarrassing but not costly)?
- Is the workflow tax (adding one more check) worth it to the people who own the pipeline?

We cannot answer these questions in a design doc. We can only answer them by listening to someone who has the problem.

---

## If We Don't Do This

We ship detection logic by week 2. We integrate with GitHub by week 3. We deploy to a beta user by week 4. By week 6, we learn: "Our team just added --skip-check to the CI config. It's faster than waiting for your blocker to run." And we've burned 6 weeks on a second version of the same failure.

If we DO this and learn the problem is real, we build with a much higher probability of adoption. If we learn it's not real, we kill the project Thursday night and move capital to something else by Monday morning.

Either way, we save runway.