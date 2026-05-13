/**
 * decisions.ts
 * In-memory decision store for MVP.
 * 
 * ASSUMPTION: Decisions are stored in memory and lost on service restart.
 * This is acceptable for MVP validation; production needs persistent storage (PostgreSQL, etc).
 * Each decision records a deployment check result.
 */

export interface Decision {
  id: string;
  repo: string;
  pullRequestNumber: number;
  commitSha: string;
  status: 'PENDING' | 'PASSED' | 'FAILED' | 'OVERRIDE';
  reason: string;
  timestamp: string;
  overriddenBy?: string;
  overrideReason?: string;
}

// In-memory store: <repo:PR> -> Decision[]
const decisionStore = new Map<string, Decision[]>();

/**
 * recordDecision
 * Adds a new deployment decision to the store.
 */
export async function recordDecision(input: {
  repo: string;
  pullRequestNumber: number;
  commitSha: string;
  status: Decision['status'];
  reason: string;
  timestamp: string;
  overriddenBy?: string;
  overrideReason?: string;
}): Promise<Decision> {
  const id = `${input.repo}:${input.pullRequestNumber}:${Date.now()}`;

  const decision: Decision = {
    id,
    repo: input.repo,
    pullRequestNumber: input.pullRequestNumber,
    commitSha: input.commitSha,
    status: input.status,
    reason: input.reason,
    timestamp: input.timestamp,
    overriddenBy: input.overriddenBy,
    overrideReason: input.overrideReason,
  };

  const key = `${input.repo}:${input.pullRequestNumber}`;
  if (!decisionStore.has(key)) {
    decisionStore.set(key, []);
  }
  decisionStore.get(key)!.push(decision);

  console.log(`[decisions] Recorded decision: ${id}`, {
    status: input.status,
    reason: input.reason,
  });

  return decision;
}

/**
 * getDecisionsForPR
 * Retrieves all decisions for a specific PR.
 */
export async function getDecisionsForPR(
  owner: string,
  repo: string,
  prNumber: number
): Promise<Decision[]> {
  const key = `${owner}/${repo}:${prNumber}`;
  const decisions = decisionStore.get(key) || [];

  console.log(`[decisions] Retrieved ${decisions.length} decisions for ${key}`);
  return decisions;
}

/**
 * getRecentDecisions
 * Returns the most recent N decisions for a repo (across all PRs).
 * Used by audit endpoint.
 */
export async function getRecentDecisions(
  owner: string,
  repo: string,
  limit: number = 20
): Promise<Decision[]> {
  const repoKey = `${owner}/${repo}`;

  // Collect all decisions for this repo.
  const allDecisions: Decision[] = [];
  for (const [key, decisions] of decisionStore.entries()) {
    if (key.startsWith(repoKey)) {
      allDecisions.push(...decisions);
    }
  }

  // Sort by timestamp descending, return most recent.
  const recent = allDecisions
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);

  console.log(
    `[decisions] Retrieved ${recent.length} recent decisions for ${repoKey}`
  );

  return recent;
}

/**
 * overrideDecision
 * Records a manual override for a PR (used when tests fail but merge is approved).
 * 
 * ASSUMPTION: Override authority is not yet implemented. Any caller can override.
 * Next cycle: add role-based override checks.
 */
export async function overrideDecision(
  repo: string,
  pullRequestNumber: number,
  overriddenBy: string,
  reason: string
): Promise<Decision | null> {
  const key = `${repo}:${pullRequestNumber}`;
  const decisions = decisionStore.get(key);

  if (!decisions || decisions.length === 0) {
    console.warn(`[decisions] No decision found to override for ${key}`);
    return null;
  }

  // Find the latest decision and record an override.
  const latestDecision = decisions[decisions.length - 1];
  const override = await recordDecision({
    repo,
    pullRequestNumber,
    commitSha: latestDecision.commitSha,
    status: 'OVERRIDE',
    reason: `Override: ${reason}`,
    timestamp: new Date().toISOString(),
    overriddenBy,
    overrideReason: reason,
  });

  console.log(`[decisions] Recorded override for ${key}`, {
    overriddenBy,
    reason,
  });

  return override;
}