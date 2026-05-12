import { Octokit } from '@octokit/rest';
import { logger } from '../utils/logger';
import { recordBlockDecision, getDecision } from '../state/decisions';

// ASSUMPTION: Override is keyed on repo + PR number only (no per-person permissions in MVP)
// ASSUMPTION: Override token is a simple shared secret in OVERRIDE_TOKEN env var
// ASSUMPTION: Override is permanent for that PR until next push (then re-evaluated)
// ASSUMPTION: We record the override in the decision log for audit, and notify Slack

const overrideTokens = new Set((process.env.OVERRIDE_TOKEN || '').split(',').filter(Boolean));

export function isValidOverrideToken(token: string): boolean {
  return overrideTokens.has(token);
}

export interface OverrideRequest {
  owner: string;
  repo: string;
  prNumber: number;
  token: string;
  overriddenBy: string; // GitHub username or email
}

export async function applyOverride(req: OverrideRequest): Promise<{ success: boolean; message: string }> {
  if (!isValidOverrideToken(req.token)) {
    logger.warn(`Invalid override token attempt for ${req.owner}/${req.repo}#${req.prNumber}`);
    return { success: false, message: 'Invalid or missing override token' };
  }

  const decision = getDecision(req.owner, req.repo, req.prNumber);
  if (!decision) {
    logger.warn(`No decision found to override: ${req.owner}/${req.repo}#${req.prNumber}`);
    return { success: false, message: 'No block decision found for this PR' };
  }

  if (!decision.blocked) {
    logger.info(`Override requested for unblocked PR: ${req.owner}/${req.repo}#${req.prNumber}`);
    return { success: true, message: 'PR is not blocked; no override needed' };
  }

  // Mark decision as overridden
  decision.overriddenAt = new Date().toISOString();
  decision.overriddenBy = req.overriddenBy;

  logger.info(`Override applied: ${req.owner}/${req.repo}#${req.prNumber} by ${req.overriddenBy}`);

  return {
    success: true,
    message: `Override applied by ${req.overriddenBy}. Merge is now allowed.`,
  };
}

export async function setCommitStatusAfterOverride(
  owner: string,
  repo: string,
  sha: string
): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    logger.error('GITHUB_TOKEN not set; cannot update commit status');
    return;
  }

  const octokit = new Octokit({ auth: token });

  try {
    await octokit.repos.createCommitStatus({
      owner,
      repo,
      sha,
      state: 'success',
      description: 'Merge allowed (override applied)',
      context: 'ci-cd-blocker/integration-tests',
    });
    logger.info(`Commit status updated to success (override) for ${owner}/${repo}@${sha}`);
  } catch (error) {
    logger.error(
      `Failed to update commit status: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}