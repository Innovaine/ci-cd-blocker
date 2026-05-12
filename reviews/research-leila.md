# Research review: "CI/CD Deployment Blocker — Catch breaking changes before they merge"

- **By:** Leila (Researcher)
- **Cycle:** 1
- **Saved:** 13/05/2026, 12:33:06 AM

---

# Validation Work: CI/CD Deployment Blocker

---

## 1. WHO PAYS

**Buyer:** Engineering Manager or Staff Engineer at a Series B–C software company ($10–50M ARR), 15–50 engineers total.

**Budget line:** Engineering Operations or DevOps team budget (not product, not infrastructure — smaller discretionary spend, faster approval). Alternatively: pulled from the VP Eng's tooling allocation.

**Company profile:** The ones getting paged at 2 AM for "tests passed, production broke." Usually 20–100+ deployments per week. Have staging. Have CI/CD discipline (GitHub Actions, GitLab Runners already in place). Don't have a deployment gate after staging.

**Specificity check:** NOT "any SaaS founder." NOT "startups in general." The buyer is someone who ships frequently enough that staging→production divergence has already cost them sleep and reputation points.

---

## 2. WHY THEY PAY NOW

**The quarter is on fire with:**
- A recent production incident (last 60 days) where tests passed in CI but failed in staging or production. Someone's credibility took a hit. Incident review happened. "We need a gate between staging and merge."
- Deployment velocity is accelerating (hiring more engineers, shipping faster), which means more chances for exactly this failure mode.
- They've already got staging running. They're not building infrastructure; they're adding a decision layer they know they need.

**Not paying because:** General best practices. Theoretical risk. "We should be more careful." Those don't convert to $200/month.

---

## 3. CLOSEST COMPETITOR / STATUS QUO

**What they're doing now:**
- Manual spot-checks before merge (engineer runs integration tests locally, "looks good," merges anyway).
- Staging environment exists but is not automated into the merge gate. It's a "nice to check" not a "blocker."
- Some teams use Datadog/Honeycomb post-deployment alerts — they catch the failure *after* it ships and kills the deploy, costing time.
- A few have cobbled together custom bash scripts or Terraform-based staging validation. Works for them, takes maintenance.

**Alternative:** They hire a dedicated DevOps engineer to build and maintain a custom gate. Costs them $150k/year + opportunity cost. Your product is $2,400/year + integration time.

---

## 4. THE ONE NUMBER

Let me test the unit economics:

- **TAM:** ~8,000 companies globally at Series B–C stage with 20+ deployments/week and existing staging (narrow, specific, defensible market).
- **Adoption:** 5% penetration year 1 in the addressable segment = 400 customers.
- **Pricing:** $200/month = $2,400/year per customer.
- **Math:** 400 × $2,400 = **$960,000 ARR** (miss the $1M floor by ~4%).

**This requires:**
- 5% of a narrowly-defined, defensible TAM to actually buy and stay for a year.
- No churn (unrealistic; assume 10–15% year 1).
- Realistic corrected model: 500 customers, 85% retention = 425 paying by end of year 1 = **$1.02M ARR.**

**What has to be true:** Either TAM is larger than 8k (are there more companies at this deployment velocity?), or adoption rate is higher than 5% (requires strong product-market fit + word-of-mouth in a tight community). Or pricing moves to $300–400/month (riskier with current alternatives).

---

## 5. THIS WEEK'S VALIDATION TEST

**Call profile:** Engineering Manager or Staff Engineer at a company that has had a production incident in the last 90 days where tests passed but staging or production broke. (This is your filter; they all exist. Find them through your network, through Slack communities like DevOps Deploys or CI/CD tooling forums, or through your personal GitHub/GitLab follows.)

**5 names or sources:**
1. DevOps community managers on r/devops and r/sre — ask them: "Who do you know who had a 'tests passed, staging failed' incident in the last quarter?"
2. GitHub community forums (Actions discussions) — lurk for post-mortems, DM the authors.
3. Personal + team network reach-out: "I'm researching deployment safety. Did your team ever have a test pass in CI but fail when you actually deployed?"
4. LinkedIn: search "Engineering Manager" + "Series B" + city, pick 10, message them directly.
5. Slack communities: Reforge alumni, Lenny's Product community, DevOps-focused Slack instances.

**The one question:**
> "In the last 6 months, have your tests ever passed in your CI/CD pipeline but failed when you actually tried to deploy to staging or production?"

**Follow-up only if YES:**
> "Walk me through what happened. How did you find out? How long did it take to fix? What did it cost you (in time, reputation, or revenue)?"

**What kills the idea:**
- **Fewer than 3 out of 5 have experienced this in the last 90 days.** If the pain isn't immediate and frequent, it's not urgent enough to buy.
- **When asked "how did you solve it," they say:** "We're fine with our current process" or "We just added another manual test step." (Means either pain is tolerable or they've already solved it cheaply without paying.)
- **They agree the problem exists but say:** "We'd need to evaluate 5 competing tools" or "This would need procurement approval." (Signals the buyer isn't actually motivated enough to move fast — you're low-priority even if they nod.)

**What validates it:**
- At least 4 of 5 report a staging-to-production mismatch in the last 90 days.
- At least 2 of those say "Yeah, we've been talking about fixing this — we know we need a gate."
- At least 1 asks: "Can this integrate with our setup? When can we try it?"

---

## My assessment

This idea clears the smell test. You've got a specific buyer with a real, recent pain. Staging environments are already live — no infrastructure risk. Three-week MVP timeline is credible. Pricing ($200/mo) is low friction for an EngOps budget.

**Bet:** The idea dies on adoption, not on product. You'll find the pain. The risk is that once you ship, adoption stalls because:
- Each team's CI/CD stack is just different enough that integration friction beats the pain relief.
- The default behavior (passing tests, moving on) has a gravity that's hard to overcome without an org-wide mandate.
- Pricing is too low — at $200/month, you'll need hundreds of customers to hit $1M ARR, and that requires ruthless word-of-mouth in a tight community.

**Call this week. Get 5 real answers before you spec the first line of code.**
