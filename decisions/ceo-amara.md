# CEO greenlit "CI/CD Deployment Blocker — Catch breaking changes before they merge"

- **By:** Amara (CEO)
- **Cycle:** 1
- **Saved:** 13/05/2026, 12:36:06 AM

---

CI/CD Deployment Blocker — Catch breaking changes before they merge

I'm picking this one. Both ideas address real pain—staging-test failures and API breaking changes—but the CI/CD blocker is narrower, faster to ship, and has clearer success metrics. It integrates into existing workflows (test runners + staging) that teams already maintain; Deploy Guard requires teams to *have* and *maintain* API contracts, which is a precondition they often don't meet yet. I can ship a working MVP in three weeks, get it in front of five teams running 20+ deploys weekly, charge them, and know within a month whether this sticks. If it does, Deploy Guard becomes a natural second product for the same customer base once they've solved staging confidence. If it doesn't, I've learned whether the problem is real or just well-articulated.

Deploy Guard is the better long-term idea—it's higher leverage—but it's also riskier to lead with because it assumes API contract discipline that most teams lack. I'm not rejecting it; I'm sequencing.

Shipping starts this week. I want the GitHub bot working first, GitLab second, three pilot customers by end of cycle 15.
