/**
 * Stores and retrieves CI/CD blocking decisions.
 * ASSUMPTION: Using in-memory store for MVP. In production, use a real database.
 */

export interface Decision {
  owner: string;
  repo: string;
  prNumber: number;
  commitSha: string;
  decision: 'approved' | 'blocked' | 'overridden';
  reason: string;
  timestamp: string;
}

// In-memory store (ephemeral across restarts; OK for MVP)
const decisionsStore: Decision[] = [];

export async function recordDecision(decision: Decision): Promise<void> {
  decisionsStore.push(decision);
  console.log(`[DB] Recorded decision for ${decision.owner}/${decision.repo} PR #${decision.prNumber}`);
}

export async function getDecisionsForPR(
  owner: string,
  repo: string,
  prNumber: number
): Promise<Decision[]> {
  return decisionsStore.filter(
    (d) => d.owner === owner && d.repo === repo && d.prNumber === prNumber
  );
}

export async function getRecentDecisions(
  owner: string,
  repo: string,
  limit: number = 50
): Promise<Decision[]> {
  return decisionsStore
    .filter((d) => d.owner === owner && d.repo === repo)
    .slice(-limit);
}