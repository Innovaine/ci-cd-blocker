export interface DecisionRecord {
  id: string; // owner/repo/pr-number/timestamp
  owner: string;
  repo: string;
  prNumber: number;
  testsPassed: boolean;
  overridden: boolean;
  overrideReason?: string;
  createdAt: number; // Unix timestamp in ms
}

interface DecisionInput {
  owner: string;
  repo: string;
  prNumber: number;
  testsPassed: boolean;
  overridden: boolean;
  overrideReason?: string;
}

// In-memory store — ASSUMPTION: Lost on restart. For MVP only.
const decisions: DecisionRecord[] = [];

export function recordDecision(input: DecisionInput): DecisionRecord {
  const id = `${input.owner}/${input.repo}/${input.prNumber}/${Date.now()}`;
  const record: DecisionRecord = {
    id,
    owner: input.owner,
    repo: input.repo,
    prNumber: input.prNumber,
    testsPassed: input.testsPassed,
    overridden: input.overridden,
    overrideReason: input.overrideReason,
    createdAt: Date.now(),
  };
  decisions.push(record);
  return record;
}

export function getDecisionsForRepo(owner: string, repo: string): DecisionRecord[] {
  return decisions.filter((d) => d.owner === owner && d.repo === repo);
}

export function getDecisionByPR(owner: string, repo: string, prNumber: number): DecisionRecord | undefined {
  // Return the most recent decision for this PR
  const relevant = decisions.filter((d) => d.owner === owner && d.repo === repo && d.prNumber === prNumber);
  return relevant.length > 0 ? relevant[relevant.length - 1] : undefined;
}

export function overrideDecision(owner: string, repo: string, prNumber: number, reason: string): DecisionRecord {
  // Create a new decision record with override flag
  return recordDecision({
    owner,
    repo,
    prNumber,
    testsPassed: true, // Override = pass
    overridden: true,
    overrideReason: reason,
  });
}