export interface DecisionRecord {
  id: string;
  timestamp: string;
  owner: string;
  repo: string;
  prNumber: number;
  status: 'approved' | 'blocked';
  reason: string;
  testsPassed: boolean;
  integrationTestUrl: string | null;
}

// In-memory store for MVP. Replace with real DB when scaling.
const decisions: DecisionRecord[] = [];

export async function saveDecision(record: DecisionRecord): Promise<void> {
  decisions.push(record);
  console.log(`Decision saved: ${record.id} - ${record.status}`);
}

export async function getRecentDecisions(limit: number): Promise<DecisionRecord[]> {
  return decisions.slice(-limit);
}

export async function getDecisionsForPR(
  owner: string,
  repo: string,
  prNumber: number
): Promise<DecisionRecord[]> {
  return decisions.filter(
    (d) => d.owner === owner && d.repo === repo && d.prNumber === prNumber
  );
}