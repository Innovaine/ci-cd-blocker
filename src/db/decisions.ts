export interface Decision {
  id: string;
  owner: string;
  repo: string;
  prNumber: number;
  status: 'approved' | 'blocked' | 'approved_override' | 'skipped';
  reason: string;
  createdAt: string;
  overrideReason?: string;
  overriddenAt?: string;
}

// In-memory store. ASSUMPTION: Acceptable for MVP (pre-revenue, no persistence requirement yet).
const decisionStore: Map<string, Decision[]> = new Map();

export function recordDecision(decision: Decision): void {
  const key = `${decision.owner}/${decision.repo}`;
  if (!decisionStore.has(key)) {
    decisionStore.set(key, []);
  }
  decisionStore.get(key)!.push(decision);
}

export function getDecisions(owner: string, repo: string): Decision[] {
  const key = `${owner}/${repo}`;
  return decisionStore.get(key) || [];
}