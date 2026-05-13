export interface Decision {
  owner: string;
  repo: string;
  prNumber: number;
  decision: 'blocked' | 'approved' | 'error';
  reason: string;
  timestamp: string;
}

// ASSUMPTION: In-memory storage. After first paying customer, move to SQLite or PostgreSQL.
const decisionStore: Decision[] = [];

export function recordDecision(decision: Decision): void {
  decisionStore.push(decision);
  console.log(
    `[decisions] Recorded: ${decision.owner}/${decision.repo}#${decision.prNumber} -> ${decision.decision}`
  );
}

export function getRecentDecisions(
  owner: string,
  repo: string,
  limit: number = 10
): Decision[] {
  return decisionStore
    .filter((d) => d.owner === owner && d.repo === repo)
    .slice(-limit)
    .reverse();
}

export function getAllDecisions(): Decision[] {
  return [...decisionStore];
}