# Manager shortlist (cycle 1)

- **By:** Dmitri (Manager)
- **Cycle:** 1
- **Saved:** 13/05/2026, 12:36:01 AM

---

I need to pick two ideas. Let me read these carefully.

**CI/CD Deployment Blocker** vs **Deploy Guard**

Both solve real problems in the same neighborhood (preventing bad deployments), but they're different enough that I should evaluate them separately.

---

## CI/CD DEPLOYMENT BLOCKER — My assessment

**What I like:**
- Leila has a tight buyer profile (Series B–C, 20+ deploys/week, already has staging). That specificity is rare and valuable.
- The validation test is concrete: "Call 5 people; if fewer than 3 experienced this in 90 days, kill it."
- Vladimir says 7 days is real if we accept hardcoded rules and no dashboard.
- Matteo's economics work at $350/month if we land 3 customers and 2 stay active by week 8. That's a real gate.

**What concerns me:**
- Matteo's LTV/CAC math (2.4x at 18-month retention) is thin. If churn hits 10%/month, we're underwater.
- Ingrid's point about "teams working around blockers" has teeth. When the bot blocks a legitimate hotfix on Friday, the engineer overrides it, deploys safely, and learns the bot is just theater. Adoption cascades downward from there.
- The "rules are hardcoded" approach means we're shipping something that catches 60–70% of the breaks Leila predicts. That's acceptable for MVP, but if false-positive rate climbs, churn accelerates.
- Still concerned about TAM. 8,000 companies with 20+ deploys/week is narrower than it sounds; Leila's validation test will tell us if the pain is actually *urgent* or just *real*.

**The core question:** Does this customer *feel urgency* to pay, or do they feel like they *should* want to pay? Matteo's gate (2 out of 3 beachhead customers still using it by week 8) is the right test for that.

---

## DEPLOY GUARD — My assessment

**What I like:**
- Real customer pain. Leila confirmed: "This isn't aspirational; they've had the incident and hired the person and that person failed."
- TAM is larger and more defensible (8,000 SaaS companies with 5+ API integrations). That's a wider moat than CI/CD.
- Vladimir says 7 days is real if we cut features ruthlessly (GitHub-only, YAML config, no dashboard, no "smart prediction").
- The problem is structural, not behavioral. Once an API goes live with external clients, breaking changes are genuinely costly. That stays true forever.

**What concerns me:**
- Matteo wants a **named list of 20 teams** to cold-contact by next week. That's a commitment I can't verify yet, and it's the right bar. If we can't name them, we don't have a customer.
- Leila's validation test requires calling 3 people and getting 2 to confirm the pain + buying urgency in a 15-minute call. That's fast feedback, but "willing to take a demo call" is not the same as "will deploy and use this."
- Ingrid's critique cuts deep: the teams that *need* this most (shipping constantly, breaking things) have the lowest tolerance for deployment gates. The teams disciplined enough to keep it enabled already version their APIs. We're solving for the middle—companies that have had the problem but haven't solved it structurally yet.
- API observability (Ingrid's alternative) might be a stronger wedge than blocking. But that's a different product and would require different validation.
- Matteo's gate (6 out of 9 deployed teams report back that it worked) is a hard ask. 3-month timeline to get there is aggressive.

---

## The choice

I'm picking both, but with a clear ranking and different confidence levels.

**PICK 1: CI/CD Deployment Blocker — Catch breaking changes before they merge**

Reason: Leila's buyer profile is tighter (not hypothetical; they have staging and incident pain), Matteo's gate (2 out of 3 customers staying active by week 8) is achievable and honest, and Vladimir's 7-day build is credible. The risk is churn on false positives, but we ship pre-hardcoded rules and iterate based on real data. This is the less ambitious, higher-confidence bet.

**PICK 2: Deploy Guard — Real-time deployment blocker for breaking API changes**

Reason: Larger TAM and more structural problem (API breaking changes don't go away), but *only* if Matteo's gate is met: we need a named list of 20 companies to contact this week and 6 of them deploying the hook and reporting back by week 6 of validation. Vladimir's 7-day build for GitHub-only is solid. But this one hinges on adoption rate; if fewer than 6 out of 9 teams report success, we kill it and redeploy the engineer.

---

## What happens now

- **Cycle 13:** Both launch in parallel. (We have runway to absorb this.)
- **CI/CD:** 3-week build, 3 beachhead customers, measure retention by week 8.
- **Deploy Guard:** 2-week MVP, 20-company cold outreach list due Monday, 6 successful deployments by week 6 or we pause.
- **Week 8 decision:** If CI/CD shows 2+ customers staying active, we fund to monetize. If Deploy Guard shows 6+ successful deployments, we fund to monetize. If either misses, we don't abandon—we diagnose why (buyer wrong? problem less urgent? UX broken?). But we don't keep burning runway on both.

The reason I'm picking both instead of ranking: My low creativity means I'm genuinely uncertain which one will find paying customers faster. Both solve real problems. Both have tight gates. Both risk churn if the adoption friction is higher than we predict. Let the market tell us.

But I'm not picking either one with high confidence. Both depend on customer behavior we haven't observed yet. Matteo's gates (retention for CI/CD, adoption rate for Deploy Guard) are the only tests that matter.
