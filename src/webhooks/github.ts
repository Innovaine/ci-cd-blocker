import { loadRepoConfig, RepoConfig } from '../config/repo-config';
import { recordDecision, Decision } from '../db/decisions';
import { notifySlack } from '../slack/notifier';
import { orchestrateTests } from '../test/orchestrator';

export interface GitHubWebhookPayload {
  action: string;
  pull_request?: {
    number: number;
    head: {
      sha: string;
      ref: string;
    };
    base: {
      sha: string;
      ref: string;
      repo: {
        name: string;
        owner: {
          login: string;
        };
        full_name: string;
      };
    };
  };
}

/**
 * Single source of truth for GitHub webhook handling.
 * Routes PR events to test orchestration, records decisions, sends Slack notifications.
 */
export async function handleGitHubWebhook(payload: GitHubWebhookPayload): Promise<any> {
  // Only handle PR open/synchronize events
  if (payload.action !== 'opened' && payload.action !== 'synchronize') {
    return { ignored: true, action: payload.action };
  }

  const pr = payload.pull_request;
  if (!pr) {
    return { error: 'No pull_request in payload' };
  }

  const owner = pr.base.repo.owner.login;
  const repo = pr.base.repo.name;
  const prNumber = pr.number;
  const headSha = pr.head.sha;

  console.log(
    `[github] Webhook: ${owner}/${repo}#${prNumber} on ${headSha.slice(0, 7)}`
  );

  // Load repo config
  const config = loadRepoConfig(owner, repo);
  if (!config) {
    console.warn(`[github] No config for ${owner}/${repo}, skipping`);
    return { skipped: true, reason: 'No config' };
  }

  try {
    // Orchestrate integration tests
    console.log(`[github] Running orchestration for ${owner}/${repo}#${prNumber}`);
    const testResult = await orchestrateTests(config, {
      owner,
      repo,
      prNumber,
      headSha,
    });

    // Determine decision
    const decision: Decision = {
      owner,
      repo,
      prNumber,
      decision: testResult.success ? 'approved' : 'blocked',
      reason: testResult.reason || 'Tests did not pass',
      timestamp: new Date().toISOString(),
    };

    // Record decision
    recordDecision(decision);

    // Notify Slack if configured
    if (config.notifyOn === 'always' || !testResult.success) {
      await notifySlack({
        owner,
        repo,
        prNumber,
        status: decision.decision,
        reason: decision.reason,
      });
    }

    return {
      owner,
      repo,
      prNumber,
      decision: decision.decision,
      reason: decision.reason,
    };
  } catch (err) {
    console.error(`[github] Error processing webhook:`, err);

    const errorDecision: Decision = {
      owner,
      repo,
      prNumber,
      decision: 'error',
      reason: `Orchestration failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      timestamp: new Date().toISOString(),
    };

    recordDecision(errorDecision);

    return {
      owner,
      repo,
      prNumber,
      decision: 'error',
      reason: errorDecision.reason,
    };
  }
}