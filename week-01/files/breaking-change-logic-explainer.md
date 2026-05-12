# Breaking Change Detection Logic — What We Actually Check

## Current implementation (translated from code for customer conversations)

The shipped code detects breaking changes by analyzing **test impact across versions:**

1. **Webhook receives a PR** — GitHub fires an event when a PR is created/updated
2. **We fetch:** 
   - Current main branch (`HEAD`)
   - New PR branch (proposed changes)
3. **We run your test suite against both:**
   - Tests pass on main? ✓
   - Tests still pass with PR changes? If NO → breaking change detected
4. **We block or warn:**
   - If tests fail with PR: block the PR (status check fails)
   - Notify the team (Slack): "3 tests failed; here's which ones"
   - Allow override: developer can manually approve ("I know what I'm doing")

## What counts as "breaking change" (our definition)
- Test failure that wasn't there before
- Import/export changes that cause tests to fail
- API signature changes detected by failing tests
- Dependency version incompatibilities (if tests catch them)

## What we DON'T check (yet)
- Code review quality
- Documentation updates
- Schema migrations (unless tests cover them)
- Type safety (unless TypeScript tests catch it)
- Undocumented API changes (unless tests exist)

## Example: "breaking change we catch"