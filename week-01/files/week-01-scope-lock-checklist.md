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