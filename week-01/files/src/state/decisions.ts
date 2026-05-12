import { logger } from '../utils/logger';

// ASSUMPTION: In MVP, decisions are stored in-memory only (lost on restart)
// ASSUMPTION: This is the single source of truth for block decisions, used for:
//   - Audit trail (what was blocked and why)
//   - Future Slack notifications (week 2)
//   - Manual override checks (week 2)

export interface BlockDecision {
  owner: string;
  repo: string;
  prNumber: number;
  headSha: string;
  baseRef: string;
  blocked: boolean;
  testsPassed: boolean;
  failureCount: number;
  failureDetails: Array<{ name: string; error: string }>;
  timestamp: string;
  overriddenAt?: string;
  overriddenBy?: string;
}

const decisionsLog: BlockDecision[] = [];

export function recordBlockDecision(decision: BlockDecision): void {
  decisionsLog.push(decision);
  logger.info(
    `Recorded decision: ${decision.owner}/${decision.repo}#${decision.prNumber} blocked=${decision.blocked}`
  );
}

export function getDecision(
  owner: string,
  repo: string,
  prNumber: number
): BlockDecision | undefined {
  return decisionsLog.find(
    (d) => d.owner === owner && d.repo === repo && d.prNumber === prNumber
  );
}

export function getAllDecisions(): BlockDecision[] {
  return [...decisionsLog];
}

export function overrideDecision(
  owner: string,
  repo: string,
  prNumber: number,
  overriddenBy: string
): void {
  const decision = getDecision(owner, repo, prNumber);
  if (decision) {
    decision.overriddenAt = new Date().toISOString();
    decision.overriddenBy = overriddenBy;
    logger.info(
      `Decision overridden by ${overriddenBy}: ${owner}/${repo}#${prNumber}`
    );
  } else {
    logger.warn(
      `No decision found to override: ${owner}/${repo}#${prNumber}`
    );
  }
}