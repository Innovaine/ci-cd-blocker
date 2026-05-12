import { getDatabase } from './schema';
import { logger } from '../utils/logger';

export interface Decision {
  id: number;
  owner: string;
  repo: string;
  pr_number: number;
  head_sha: string;
  decision: 'blocked' | 'passed';
  test_passed: boolean;
  failure_count: number;
  failure_details?: string;
  created_at: string;
}

export interface Override {
  id: number;
  owner: string;
  repo: string;
  pr_number: number;
  overridden_by: string;
  reason?: string;
  created_at: string;
}

export function recordDecision(params: {
  owner: string;
  repo: string;
  pr_number: number;
  head_sha: string;
  decision: 'blocked' | 'passed';
  test_passed: boolean;
  failure_count: number;
  failure_details?: Array<{ name: string; error: string }>;
}): Decision {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO decisions (owner, repo, pr_number, head_sha, decision, test_passed, failure_count, failure_details)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const failureDetailsJson = params.failure_details
    ? JSON.stringify(params.failure_details)
    : null;

  const result = stmt.run(
    params.owner,
    params.repo,
    params.pr_number,
    params.head_sha,
    params.decision,
    params.test_passed ? 1 : 0,
    params.failure_count,
    failureDetailsJson
  );

  logger.info(
    `Decision recorded: ${params.owner}/${params.repo}#${params.pr_number} → ${params.decision}`
  );

  return {
    id: result.lastInsertRowid as number,
    owner: params.owner,
    repo: params.repo,
    pr_number: params.pr_number,
    head_sha: params.head_sha,
    decision: params.decision,
    test_passed: params.test_passed,
    failure_count: params.failure_count,
    failure_details: failureDetailsJson || undefined,
    created_at: new Date().toISOString(),
  };
}

export function recordOverride(params: {
  owner: string;
  repo: string;
  pr_number: number;
  overridden_by: string;
  reason?: string;
}): Override {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO overrides (owner, repo, pr_number, overridden_by, reason)
    VALUES (?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    params.owner,
    params.repo,
    params.pr_number,
    params.overridden_by,
    params.reason || null
  );

  logger.info(
    `Override recorded: ${params.owner}/${params.repo}#${params.pr_number} by ${params.overridden_by}`
  );

  return {
    id: result.lastInsertRowid as number,
    owner: params.owner,
    repo: params.repo,
    pr_number: params.pr_number,
    overridden_by: params.overridden_by,
    reason: params.reason,
    created_at: new Date().toISOString(),
  };
}

export function getDecisionsForPR(
  owner: string,
  repo: string,
  prNumber: number
): Decision[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM decisions
    WHERE owner = ? AND repo = ? AND pr_number = ?
    ORDER BY created_at DESC
  `);

  return stmt.all(owner, repo, prNumber) as Decision[];
}

export function getOverridesForPR(
  owner: string,
  repo: string,
  prNumber: number
): Override[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM overrides
    WHERE owner = ? AND repo = ? AND pr_number = ?
    ORDER BY created_at DESC
  `);

  return stmt.all(owner, repo, prNumber) as Override[];
}

export function getRecentDecisions(owner: string, repo: string, limit = 50): Decision[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM decisions
    WHERE owner = ? AND repo = ?
    ORDER BY created_at DESC
    LIMIT ?
  `);

  return stmt.all(owner, repo, limit) as Decision[];
}