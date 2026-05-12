# HR staffing plan: "CI/CD Deployment Blocker — Catch breaking changes before they merge"

- **By:** Sienna (HR)
- **Cycle:** 1
- **Saved:** 13/05/2026, 12:36:20 AM

---

# TEAM PLAN: CI/CD Deployment Blocker

**Organizational structure:** Extend the existing **Product Engineering team** (not a new department).

**Staffing (7-14 day sprint):**

1. **1 Backend Engineer** — owns GitHub webhook ingestion, test result parsing, merge-block API calls, Slack notification plumbing. This is the load-bearing role.
2. **1 Frontend Engineer** — builds the override UI (one-page decision surface: "why did this block? override + add comment?"). Minimal but non-negotiable; a CLI or Slack command alone won't ship.
3. **1 DevOps/Infra Engineer** — owns staging environment orchestration, test runner integration points, credential/secret handling. Can't be improvised.
4. **1 Product Engineer (part-time, 40% allocation)** — deploys to early users, collects test-failure telemetry, feeds back failure patterns that inform v2 rules. Sits with the backend eng.

**Total headcount: 3.4 FTE; duration: assigned for 2 cycles (3-4 weeks to stabilize, then iterate).**

---

## Concerns

Still concerned about execution fatigue (55/100) — we're at 1 blocked cycle already, and this adds parallel load to Product Eng. If the team wasn't already carrying capacity in that function, we're risking both this and whatever else they own. Need explicit confirmation from the eng lead that this doesn't collide with their current roadmap priority.

Also: the chairman cut rollback plan and pre-built rules to descope. That's smart for MVP speed, but it means we're shipping a blocker without remediation — teams will be frustrated fast if they hit it and have no guidance. Plan for that friction in cycle 2; don't pretend it doesn't exist.
