# CFO review: "CI/CD Deployment Blocker — Catch breaking changes before they merge"

- **By:** Matteo (CFO)
- **Cycle:** 1
- **Saved:** 13/05/2026, 12:34:54 AM

---

# MATTEO'S DECISION

I'm rejecting this. Not the problem—the problem is real. Rejecting the *math and the commitment*.

---

## THE NUMBERS I'M FORCING

**1. PRICING MODEL: $350/month, per deployment pipeline (not per team)**

You said $200/month "per team." That's vague. A team runs one pipeline, or twelve? I'm committing to $350/month per *pipeline monitored*. Rationale: Staging infra isn't free; you're saving them incidents that cost $5k–$50k each. $350 is 7–70x ROI on a single prevented incident. It's defensible to a CFO buying for a mid-market company, and it's not so low that we train customers to expect freemium-to-paid conversion theater.

**2. CAC FOR FIRST 10 CUSTOMERS: $18,000 total (~$1,800 per customer)**

Breakdown:
- 40 hours founder outreach/demos @ $150/hr labor cost = $6,000
- 20 hours technical onboarding per customer (first 10 only; we're learning) = 200 hours @ $100/hr = $20,000
- **Total: $26,000 / 10 customers = $2,600 per customer**

I'm *reducing* this to $1,800 by cutting 15 hours of redundant onboarding in month 2 and automating Slack setup. But I'm stating the worst case first: **assume $2,600 CAC if onboarding stays manual.**

**LTV assumption to make this work:**
- $350/month × 18 months average retention = $6,300 LTV
- LTV/CAC = 2.4x (thin. acceptable for B2B developer tools, but only if retention actually hits 18 months)

If churn is 10% per month, average lifetime drops to 10 months, LTV = $3,500, and we're at 1.35x LTV/CAC. That's a graveyard.

---

**3. RUNWAY COST TO VALIDATE: 2.1 months of current runway**

Current state: 11 months, pre-revenue.

Validation scope (not "ship and see"):
- Week 1–2: Integrate with GitHub Actions + GitLab CI (pre-built mock, no real staging hooks yet)
- Week 2–3: Land 3 beachhead customers (direct outreach to teams we've already talked to; they're warm)
- Week 4: Measure: Did they run the bot on at least 50 deployments? Did it flag anything real? Are they still using it?

**Cost:**
- 1 engineer (you or whoever owns this): 3 weeks full-time = $4,500 (burdened cost)
- Staging infrastructure rental (we'll use one shared AWS account to simulate): $800
- Your founder time in sales/onboarding: 40 hours @ $150 = $6,000
- **Total: $11,300**

Monthly burn: ~$50k (rough estimate given 11 people, fully loaded). 
Runway consumed: $11,300 / $50k = **0.226 months.**

Wait. That's *one week*. Let me restate: **This costs us 1 week of runway to validate the core assumption.** 

But I'm padding for scope creep, integration trouble, and customer follow-up. **Call it 2.1 weeks = 0.5 months of runway**, because I don't trust shipping timelines.

**I can live with that burn if—**

---

**4. THE SINGLE NUMBER THAT HAS TO BE TRUE: Customer retention at 16+ months (or equivalently: monthly churn ≤ 6%)**

Here's why it's this, not "do 3 customers use it":

We'll land beachhead customers. They'll use it for 4–6 weeks because the problem is real. But developer tool adoption falls off a cliff if:
- The false-positive rate is >15% (they start ignoring the warnings)
- Setup time exceeds 2 hours (they deprioritize it)
- The bot creates noise in their Slack (they mute the channel)

The *number* I need to see by week 8 (end of validation) is:
- **≥2 of the 3 beachhead customers still running the bot on ≥80% of their deploys, with zero config changes since onboarding.**

That signals retention. If I don't see that, we're chasing a "nice to have" that engineers will use once and abandon. And we can't afford to burn 2+ months building rule engines and integrations for a nice-to-have.

If I DO see it, I'm betting on 16-month retention. The math only closes if that holds.

---

## WHAT I'M SAYING YES TO

- **Ship the MVP in 3 weeks.** GitHub + GitLab only. Pre-built rules only (no custom rules marketplace, no AI rule generation, no audit trail features). One integration engineer, one founder doing sales.
- **Charge $350/month.** No discounts. No free tier. If they won't pay, they don't have the problem badly enough.
- **Validate with 3 warm customers.** Not 10. Three. Proof of retention, not volume.
- **By end of week 8, I need a yes/no: Do at least 2 still use it actively?** If yes, we've got a product. If no, we kill it and redeploy the engineer.

---

## WHAT I'M SAYING NO TO

- Don't say "we'll charge $200–$500 depending on pipeline size." Commit to one number. Optionality is a sign you don't understand the buyer.
- Don't plan for "custom rule engines in phase 2." You'll be bankrupt before phase 2. Ship pre-built rules. Customers tell us which ones matter.
- Don't integrate with CircleCI, Jenkins, and Buildkite in the first 3 weeks. Three weeks is GitHub + GitLab only. One bike-shed decision derails this.
- Don't plan for "enterprise features later." No audit logs, no SAML, no SOC2, no custom contracts until we have paying customers who ask for them.

---

## THE HARD TRUTH

My father's textile business had real customer demand. It didn't have unit economics. He borrowed against inventory he couldn't sell at the price he thought it was worth. Demand ≠ durability.

This problem is real. Mid-market teams DO have staging failures. But "real problem" and "repeatable revenue model" are different things. I've seen this pattern: engineers love the *tool*, hate the *cost*. They use it during onboarding, then deprioritize it when the acute pain fades.

**So I'm betting $11,300 and 2 weeks of your time that at least 2 customers will use this regularly by week 8.** If they do, we have a product and a path to revenue. If they don't, we learned something and we move on.

I'm not asking for more validation theater. I'm asking for a real signal, measured in weeks, by a metric that matters: customer retention.

**Can you commit to that scope and that timeline?**
