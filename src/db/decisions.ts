// In-memory decision store (lost on restart; MVP only).
interface DecisionRecord {
  owner: string;
  repo: string;
  prNumber: number;
  testsPassed: boolean;
  overridden: boolean;
  overrideReason?: string;
  timestamp: number;
}

const store: Map<string, DecisionRecord> = new Map();

export function recordDecision(decisionId: string, decision: DecisionRecord): void {
  store.set(decisionId, decision);
  console.log(`[DB] Decision recorded: ${decisionId}`);
}

export function getDecisionForPR(owner: string, repo: string, prNumber: number): DecisionRecord | undefined {
  const decisionId = `${owner}/${repo}#${prNumber}`;
  return store.get(decisionId);
}

export function getRecentDecisions(owner: string, repo: string): DecisionRecord[] {
  const repoPrefix = `${owner}/${repo}#`;
  const results: DecisionRecord[] = [];

  store.forEach((decision, decisionId) => {
    if (decisionId.startsWith(repoPrefix)) {
      results.push(decision);
    }
  });

  // Sort by timestamp descending (most recent first).
  return results.sort((a, b) => b.timestamp - a.timestamp);
}