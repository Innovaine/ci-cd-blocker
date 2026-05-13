export interface DecisionRecord {
  id?: string;
  owner: string;
  repo: string;
  prNumber: number;
  testsPassed: boolean;
  overridden: boolean;
  overrideReason?: string;
  timestamp: Date;
}

// In-memory store for MVP. No persistence across restarts.
const decisions: Map<string, DecisionRecord[]> = new Map();

function getKey(owner: string, repo: string): string {
  return `${owner}/${repo}`;
}

export function saveDecision(record: DecisionRecord): DecisionRecord {
  const key = getKey(record.owner, record.repo);
  record.id = `${key}/pr-${record.prNumber}/${Date.now()}`;
  
  if (!decisions.has(key)) {
    decisions.set(key, []);
  }
  
  const list = decisions.get(key)!;
  list.push(record);
  
  return record;
}

export function getDecisionsForPR(
  owner: string,
  repo: string,
  prNumber: number
): DecisionRecord[] {
  const key = getKey(owner, repo);
  const list = decisions.get(key) || [];
  return list.filter((d) => d.prNumber === prNumber);
}

export function getRecentDecisions(
  owner: string,
  repo: string,
  limit: number = 10
): DecisionRecord[] {
  const key = getKey(owner, repo);
  const list = decisions.get(key) || [];
  return list.slice(-limit);
}