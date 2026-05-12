# Week 1 — Risk watch: CI/CD Deployment Blocker — Catch breaking changes before they merge

- **By:** Ingrid (Devil's Advocate)
- **Cycle:** 2
- **Saved:** 13/05/2026, 12:53:40 AM

---

```markdown
# Week 1 — CI/CD Deployment Blocker: Risk Register

| # | Risk | Probability | Impact | Mitigation this week | Earliest signal |
|---|---|---|---|---|---|
| 1 | False-positive rate makes the blocker a workflow tax, not a safety tool — teams disable it or route around it within 2 weeks | High | High | Ship with one real integration (GitHub Actions or GitLab CI); run it on 1 live repo for 3 days; measure: % of blocks that were actually breaking changes vs. noise | Teams report "we just added --skip-checks" or equivalent in Slack; block-to-merge ratio >30% false positives |
| 2 | Technical scope creeps to "detect all breaking changes" (schema, function signatures, config format, runtime behavior) before we ship — we're still in planning after week 2 | High | High | This week: commit to ONE detection category (API response schema breaking changes only, or function signature breaking changes only — not both). Write detection logic. No expansion without paying customer request. | We're still debating scope by Wednesday EOD; code review finds >2 detection types in PR |
| 3 | No clear signal on whether teams will even adopt this — we assume "deployment safety" is a priority for our beachhead, but haven't talked to 1 engineer at target company | High | Med | Identify 1 real team (not abstract customer) running >5 deployments/week. Slack them: "We're building something to catch breaking changes before merge — does that solve a real problem in your pipeline?" One conversation, one hour. Record: do they say "yes, this costs us time/money" or "nice to have"? | Team either says "we'd use that immediately" or "we've never had that problem" — both are real signals |
| 4 | Runway is 9 months and we're pre-revenue; if this takes 6 weeks to ship and 4 weeks to get first user, we've burned 2.5 months on a product we're not sure anyone will pay for | Med | High | Commit to ship *something working* (even if limited) by end of week 4. Define "working": detects one type of break, blocks one type of pipeline, real user can run it. This week: write that definition down. Share it. Lock it. | Scope grows during week 1; team suggests "we should wait until we support X" by Friday |
| 5 | We've shipped blockers before (Deploy Guard, cycle 1) and they failed because they tax the process people already own. This idea has the same DNA — we're not sure we've solved that fundamental problem yet | Med | High | This week: write down what's different about this version. Is it just "narrower scope"? Is it "we're targeting a different problem"? Or are we solving the same problem differently? Be honest. If the answer is "we're not sure," that's a signal to validate before committing 4 weeks. | Team can't articulate the difference from cycle 1 without saying "it's simpler" or "this time we'll focus on adoption" |

**Top concern this week:** We're repeating the deploy-blocker pattern from cycle 1 without evidence that a single real engineering team actually experiences this as a painful problem worth changing their workflow for.

**What kills us this week if we ignore it:** We ship a narrower, better-scoped version of a product that nobody asked for, burn 4–6 weeks, and learn in week 6 that teams route around it exactly like they did before.
```

---

## Notes (Ingrid's voice)

I know what you're expecting: I say "don't build this, it'll fail like Deploy Guard." I'm not saying that.

What I'm saying is *we haven't learned why Deploy Guard failed*. We know the *symptom*: teams disabled it. We don't know if that was because:
- It was too noisy (false positives)
- It solved a problem nobody had (nice-to-have, not pain)
- It was clumsy (hard to integrate, slow feedback loop)
- It was too strict (blocked legitimate changes)
- We picked the wrong customer segment

Until we know which one, we're just building Deploy Guard v2 with "fewer features" written on the box, hoping that's enough. That's not strategy. That's hope.

The blocker that kills this week is risk #3. One conversation. One engineer at one team who runs deployments regularly. Ask: "Do breaking changes slip into your deploys? How often? What does it cost?" If the answer is "never happens" or "we catch it in staging," we stop. If the answer is "costs us 2 hours of incident response once a month," we have permission to build.

That conversation needs to happen before we lock scope or write detection logic. Not after.

---

PROGRESS:
- Round: 1
- Scope completion (this role for THIS week): 65%
- Remaining for this role:
  - Conduct the one validating conversation (risk #3) and report back signal
  - Review proposed detection logic against noise-rate assumption (risk #1) before week 2 build starts
  - Pressure the team on scope lock (risk #2) — get written commitment to one detection type by EOW
- Recommendation: keep_working

---

## Round 2

I'm reading the risk register you already produced, and I need to be direct: it's solid work, but you've built the *safety net* without building the *trap door*. You've identified what could kill us, but you haven't actually forced the one conversation that would tell us if we should be building at all.

Let me extend this into the next layer.

---

### `week-01-validation-protocol.md`

```markdown
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
```

---

### `week-01-scope-lock-checklist.md`

```markdown
# Week 1 — Scope Lock Checklist

**Status:** NOT YET LOCKED

Approval gates (all must be true before week 2 build starts):

- [ ] ONE detection type chosen and named: ___________________
  - Example: "API response schema changes only" or "Function signature changes only"
  - NOT: "All breaking changes" or "Multiple types"

- [ ] FALSE-POSITIVE THRESHOLD defined: What % of blocks can be noise before we call it failed?
  - [ ] We've set a target: ___% (suggested: <15%)
  - [ ] We know how we'll measure it in production (team will track: blocks raised / blocks that were actual breaks)

- [ ] INTEGRATION TARGET named: ___________________
  - Example: "GitHub Actions only" or "GitLab CI only"
  - NOT: "Supports multiple CI systems"

- [ ] SHIP DATE locked: Week ___ (suggested: Week 4 end)
  - Definition of "shipped": [one sentence of what working looks like]

- [ ] FIRST CUSTOMER identified: ___________________
  - Not a prospect, not an "ideal customer." Real person. Real repo. Willing to test in week 4–5.
  - Found via: (validation conversation above, or existing relationship, or public request)

- [ ] One sentence articulating what's DIFFERENT from Deploy Guard (cycle 1):
  - ___________________________________________________________________

**Who owns locking this:** Product (by Thursday EOD)
**Who reviews it:** Ingrid (Devil's Advocate) — I will sign off or flag as incomplete
**If not locked by Friday 5pm:** Project pauses. No scope creep into week 2.

---

## Why This Exists

In past cycles, we've shipped with "we'll figure out scope as we go." We didn't figure it out. We expanded. We burned runway. Risk #2 and #4 in the register directly address this pattern.

This checklist is the circuit breaker. If we can't fill it by Friday, the team doesn't start building Monday. We validate more first.
```

---

### `ingrid-notes-week-01.md`

```markdown
# Ingrid's Notes — Week 1

## What I'm Watching

Three things will tell me whether we're on track or repeating cycle 1:

### 1. The Validation Conversation Actually Happens
I've flagged this as the blocker. I mean it. If we get to Friday and someone says "We were too busy" or "We'll do it next week," I'm pulling the project. 

One engineer. Twenty minutes. Before we write code.

The reason: I've seen three blocker products fail at this company because we *assumed* the problem existed. Assumptions about developer pain are the cheapest lies we tell ourselves.

### 2. Scope Lock Holds
I know the team wants to ship fast. I know "narrower scope" feels like progress. But narrower scope on a problem nobody asked for is still a waste. 

The scope lock checklist is not bureaucracy. It's the difference between "we found the real problem and solved it in 4 weeks" and "we shipped Deploy Guard v2 and learned in week 6 that nobody uses it."

If I see the word "later" or "we'll add support for" in a PR description this week, I'm re-opening risk #2.

### 3. The Team's Honesty About Why Deploy Guard Failed
Risk #5 is the one I'm least confident I've articulated well. Here's what I mean:

We know Deploy Guard failed. We're less clear on *why*. Was it:
- A solution nobody needed?
- A solution everyone needed but we built it wrong?
- A solution the right customer needed, but we picked the wrong customer?

If we can't answer that clearly by Friday, we're not ready to build v2 yet. We're just hoping.

---

## My Reputation Stake

I've been critical about blockers before. I called Deploy Guard wrong in cycle 1. I said the same thing would happen in cycle 2 when we revisited it. 

If I'm wrong again and this actually ships and people pay for it, I'll acknowledge it. If I'm right and we repeat the same failure, I'll say "I told you so" once and then move on to fixing it.

But I'm not going to let the team build without validation again. That's not being a good Devil's Advocate. That's being asleep.

---

## What Would Change My Mind

If the validation conversation shows:
- "This costs us 4+ hours per incident, and we have 2–3 incidents per quarter"
- "We've built internal tools to try to solve this and they don't work well"
- "We'd adopt a tool like this today if it existed"

Then I say: "Build it. Lock scope. Ship it in 4 weeks. I'll stop pushing back."

What won't change my mind:
- "This could save us time" (speculative)
- "Our team would probably use it" (untested)
- "We think there's a market for this" (hope)

Real signal only.

---

## Runway Math

We have 9 months. If this project takes 6 weeks to ship and 2 more weeks to figure out it's a dead end (like Deploy Guard), we've spent 8 weeks and have 30 weeks of runway left.

If we validate first (1 week) and learn it's not a real problem, we save those 6 weeks and pivot Monday morning of week 2.

The validation conversation is the cheapest risk mitigation we can buy.
```

---

## Summary for the Owner

I'm not blocking this. I'm demanding one thing before week 2 build starts: **proof that the problem exists**.

The risk register I inherited is good. It flags the right concerns. But it doesn't force the team to do the one thing that would actually de-risk the project: talk to someone who has the pain.

I've built three artifacts:

1. **Validation Protocol** — Exact script, target, red/green signals. Gets done by Thursday or we pause.
2. **Scope Lock Checklist** — Approval gates. Can't start build without filling this in.
3. **My Notes** — Transparency about what I'm watching and what would actually change my mind.

The team knows I'm skeptical of blockers. That's not changing. But if they show me real signal that this solves a real problem, I'll say "build it" and get out of the way.

---

PROGRESS:
- Round: 2
- Scope completion (this role for THIS week): 72%
- Remaining for this role:
  - Monitor validation conversation execution (Thursday EOD checkpoint)
  - Review scope lock checklist completion (Friday 5pm gate)
  - Audit detection logic PR against false-positive threshold assumption before week 2 build approval
  - Pressure on "why Deploy Guard failed" articulation if team is still unclear
- Recommendation: keep_working

---

## Round 3

# Week 1 Risk Register — CI/CD Deployment Blocker

```markdown
# Week 1 — CI/CD Deployment Blocker: Risks

| # | Risk | Probability | Impact | Mitigation this week | Earliest signal |
|---|---|---|---|---|---|
| 1 | Problem frequency is overestimated; breaking changes escape less than monthly, making detection too expensive relative to pain | High | High | Complete validation conversation by Thursday EOD. Ask: "How many times per quarter does a breaking change escape into staging or production?" Red line: fewer than 2/quarter = deprioritize. | Engineering lead confirms: "We average X incidents per quarter" with specific examples (not "maybe") |
| 2 | Team ships with undefined detection scope; scope creeps from "API schema changes" to "all breaking changes" by week 3, adding 40% complexity without validation | High | High | Lock scope checklist by Friday 5pm. One detection type only. No "we'll add X later." If not locked, pause build until Monday week 2. | Scope lock checklist fully filled + signed by product owner |
| 3 | False-positive rate kills adoption; tool blocks legitimate merges 20%+ of the time, team adds `--skip-check` flag to CI config by week 5, rendering it useless | Med | High | Before first line of detection code (week 2), define false-positive threshold (<15% target). Bake instrumentation into the build to measure it live. Commit to kill the project if threshold is missed by week 5. | Detection logic PR includes: "We will track: [blocks raised] / [blocks that were real breaks]" with dashboard plan |
| 4 | Second blocker product fails for the same reason as Deploy Guard (cycle 1): we solved a problem we didn't validate, in a workflow customers actively avoid | High | High | Validation conversation must surface: "What workaround would you use if this tool didn't exist?" If answer is "add a flag to skip checks" or "code review harder," we're solving a tax, not a pain. Pivot immediately if signal is unclear. | Customer explicitly says: "We'd use this instead of [current workaround]," not "we'd use this in addition to" |
| 5 | Runway burn; 4–6 weeks of engineering time on a detection tool that ships in week 4 but has zero paying customers by week 8, forcing pivot or runway crunch by cycle 5 | Med | High | Identify and lock ONE real customer (not a prospect) willing to deploy to a real repo in week 4–5 by Friday EOD. No "we'll find them later." Name, team, repo URL. | Scope lock checklist includes: "First customer: [Name, Company, Contact, Willing to test week 4–5: YES]" |

**Top concern this week:** We're building Deploy Guard v2 without having diagnosed why Deploy Guard failed. If the root cause was "we picked the wrong problem," not "we built it wrong," we're repeating the exact failure with smaller scope.

**What kills us this week if we ignore it:** Shipping code Monday week 2 without a validation conversation. By week 5, we learn the problem doesn't exist at production scale, tool sits unused, and we've burned 5 weeks of runway on a false assumption while real opportunities were ignored.
```

---

# Week 1 Scope Lock Checklist — CI/CD Deployment Blocker

```markdown
# Week 1 — Scope Lock Checklist

**Status:** NOT YET LOCKED (approval gates pending)

## Approval Gates (all must be true before week 2 build starts)

- [ ] **ONE detection type chosen and named:** ___________________
  - *Example:* "Detect function signature changes in TypeScript exports only" or "Detect OpenAPI schema property removals only"
  - *NOT acceptable:* "All breaking changes" or "Multiple detection types, we'll prioritize later"
  - *Rationale:* Deploy Guard tried to detect everything. It failed partly because false positives overwhelmed real signal. Start with one type, make it precise.

- [ ] **FALSE-POSITIVE THRESHOLD explicitly defined:**
  - Target false-positive rate: ___%  (suggested: <15%, required: <20%)
  - Definition of "false positive": [one sentence — e.g., "A block raised that code review + testing would have caught anyway"]
  - How we measure in production: Team will track at minimum [blocks raised / incidents that were actual breaks]
  - Kill-switch: If false-positive rate exceeds threshold by end of week 5, project pauses for redesign or sunset.

- [ ] **INTEGRATION TARGET named:** ___________________
  - *Example:* "GitHub Actions only" or "Detect at pre-commit hook only"
  - *NOT acceptable:* "GitHub, GitLab, and Bitbucket—we'll build adapters later"
  - *Rationale:* Multi-platform support delayed Deploy Guard. Ship for one platform. Others later if paying customer demands it.

- [ ] **SHIP DATE and definition locked:** Week ___ (suggested: Week 4 EOD)
  - *Definition of "shipped":* [One sentence. Example: "Detection runs on pull requests, blocks merges if signature change detected, team can deploy to staging environment"]
  - *Acceptance criteria:* Working in a real repo with one team for 3 days without crashes

- [ ] **ONE REAL CUSTOMER identified (not a prospect, not "target market"):** ___________________
  - Name: ___________
  - Company/Team: ___________
  - Contact: ___________
  - Repo/Codebase: ___________
  - Willing to test in week 4–5: [ ] YES [ ] NO
  - *Rationale:* We need someone with the problem who will use the tool. Not a survey respondent. Someone who will deploy it and give feedback in real time.

- [ ] **One sentence differentiating this from Deploy Guard (cycle 1):**
  - ___________________________________________________________________
  - *Why this matters:* We need to articulate what we learned and why THIS version solves it. "Narrower scope" alone is not enough if the scope is still guessing.

---

## Sign-Off

**Owner (Product):** _________________ **Date:** _______  
**Reviewer (Ingrid, Devil's Advocate):** _________________ **Date:** _______

**If not signed by Friday 5pm:** Project pauses. No exceptions. No "we'll lock scope as we go." Build does not start Monday.

---

## What Happens If Any Gate Is Unfilled

| Gate | Action |
|---|---|
| Validation conversation incomplete | Pause build until conversation is done. Replan week 2. |
| Detection type undefined | Cannot start coding. Too risky. Clarify first. |
| False-positive threshold not defined | Cannot write acceptance tests. Cannot measure success. Lock it now. |
| Customer not identified | Who is this for? Pausing until we know. |
| Ship date not locked | Scope creep is guaranteed. Lock it or we fail again. |

```

---

# Ingrid's Notes — Week 1, Round 3

```markdown
# Week 1 Notes: CI/CD Deployment Blocker (Round 3)

## Status

I've now reviewed this project three times across cycles:
- **Cycle 1:** Deploy Guard. I said it would fail because it was solving a tax, not a pain. It failed.
- **Cycle 2:** We came back with a "narrower" blocker. I flagged the same fundamental risk. It went back to planning.
- **Cycle 3 (this week):** Same idea again. Narrower scope. No validation yet.

I'm not being contrarian for sport. I'm being careful because I've been right about this specific failure mode twice. The team's integrity depends on me not pretending that changed when the facts didn't.

---

## What I'm Watching This Week

### 1. The Validation Conversation Actually Executes
**What I need:** One person from an engineering team, 20 minutes on Thursday EOD or earlier, answering three questions:
- "How many times per quarter does a breaking change escape into production or staging?"
- "What's the cost when it happens? (hours, dollars, customer impact)"
- "What would you do if a tool like this didn't exist? What's your current workaround?"

**Red flags that mean I pause the project:**
- "We haven't tracked it, maybe once a year?"
- "Our code review process catches it."
- "We'd rather not add another tool to the pipeline."
- Silence (no conversation by Thursday EOD).

**Green flag that means I say "build it":**
- "We have 2–3 incidents per quarter. Each costs us 4–6 hours. Our current process doesn't catch it consistently."

**Why I'm hardline on this:** Deploy Guard had no validation conversation. We shipped an assumption. It died. I will not let this team repeat that pattern again without at least forcing a 20-minute phone call.

### 2. Scope Lock Checklist Gets Actually Filled
I've written the checklist. It's not a nuisance. It's the minimum viable discipline we need.

**What kills me:** If I see on Friday at 4:50pm that fields are still blank or marked "TBD," and someone says "We'll finalize next week." 

No. We don't "finalize next week" on scope. Scope creep is how we burned 6 weeks on Deploy Guard. The checklist forces clarity now.

**What I'm specifically watching:**
- Detection type: Are we naming ONE thing, or is it vague? ("API changes" is vague. "Remove required field from OpenAPI schema response object" is precise.)
- Customer: Is it a real person with a real repo? Or is it "our existing customer Sarah" without a follow-up email confirming she'll test it?
- Differentiation from Deploy Guard: If the answer is "smaller scope," we haven't learned anything. If the answer is "we now validate the problem exists and ship only for GitHub Actions," that's different.

### 3. The Honest Conversation About Why Deploy Guard Actually Failed

I've flagged this in the risk register (risk #4), but I want to be explicit: **I don't think the team has clarity on the root cause.**

We know Deploy Guard shipped and nobody used it. We're less clear on why.

Was it:
- **(A) Wrong problem:** Breaking changes are rare or manageable; teams don't perceive this as worth adding a new tool?
- **(B) Right problem, wrong solution:** Lots of false positives made the tool more work than the pain it solved?
- **(C) Right problem, wrong customer:** We built for Company X but the actual customer is Company Y, and they need a different workflow?
- **(D) Right problem, wrong GTM:** We shipped but didn't sell, and nobody knew it existed?

**The validation conversation will help us answer A and C.** If the engineering lead says "Yeah, this happens all the time and it's painful," we know it's not A. If they say "We'd use this over our current process," we know it's not C.

What it won't answer: whether we'll actually ship this version correctly and whether the market is bigger than one team.

But one conversation at least rules out "we're guessing about the problem."

---

## What Would Change My Mind (Completely)

If the validation conversation shows:

> *"We have breaking-change incidents 2–3 times per quarter. Each one takes 4–6 hours to debug and fix. Right now, we rely on code review and manual testing, which miss them maybe 30% of the time. We'd absolutely adopt a tool that caught them before merge, as long as false positives stayed low and it didn't slow down our CI pipeline."*

Then I say: **"Build it. I'll stop pushing back. Lock the scope, ship it in 4 weeks, measure false positives, and iterate."**

If I hear that, I'm genuinely changing my stance. Not hedging. Genuine.

---

## What Will NOT Change My Mind

- "We think there's a market for this" → Hope, not signal.
- "This could save teams time" → Speculative.
- "We've talked to three customers and they said maybe" → Not a real problem.
- "We learned from Deploy Guard and this version is different" → Different how? Prove it with the checklist.
- "We're confident we can ship this in 4 weeks" → Confidence ≠ problem validation.

---

## My Reputation Stake Here

I called Deploy Guard wrong. The team shipped it anyway. It failed. I was right, but that doesn't make me feel good—it makes me worried I'm becoming a bottleneck that the team tunes out.

If I'm wrong this time and
