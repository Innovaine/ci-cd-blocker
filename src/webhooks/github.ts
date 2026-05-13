/**
 * GitHub webhook handler: receives push/PR events, runs integration tests,
 * blocks merge if tests fail, notifies Slack.
 */

import { orchestrateTests } from '../test/orchestrator.js';
import { loadRepoConfig } from '../config/repo-config.js';
import { recordDecision } from '../db/decisions.js';
import { notifySlack } from '../slack/notifier.js';

export interface GitHubWebhookPayload {
  action?: string;
  pull_request?: {
    number: number;
    head: {
      sha: string;
    };
    user: {
      login: string;
    };
  };
  repository: {
    name: string;
    owner: {
      login: string;
    };
  };
}

export async function handleGitHubWebhook(payload: GitHubWebhookPayload) {
  // Only care about PR opened/synchronize events
  if (!payload.pull_request) {
    console.log('[GitHub] Ignoring non-PR event');
    return { ignored: true };
  }

  const { action } = payload;
  if (!['opened', 'synchronize'].includes(action || '')) {
    console.log(`[GitHub] Ignoring PR action: ${action}`);
    return { ignored: true };
  }

  const pr = payload.pull_request;
  const repo = payload.repository;
  const owner = repo.owner.login;
  const repoName = repo.name;
  const prNumber = pr.number;
  const commitSha = pr.head.sha;
  const authorLogin = pr.user.login;

  console.log(`[GitHub] Processing PR #${prNumber} in ${owner}/${repoName}`);

  try {
    // Load repo config
    const config = await loadRepoConfig(owner, repoName);
    console.log(`[GitHub] Loaded config:`, config);

    // Run integration tests
    const testResult = await orchestrateTests(config);
    console.log(`[GitHub] Test result:`, testResult);

    // Determine decision
    const decision = testResult.passed ? 'approved' : 'blocked';
    const reason = testResult.passed
      ? 'Integration tests passed'
      : `Integration tests failed: ${testResult.error || 'unknown error'}`;

    // Record decision
    await recordDecision({
      owner,
      repo: repoName,
      prNumber,
      commitSha,
      decision,
      reason,
      timestamp: new Date().toISOString(),
    });

    // Notify Slack
    const slackMessage =
      decision === 'approved'
        ? `:white_check_mark: PR #${prNumber} *approved* — tests passed`
        : `:x: PR #${prNumber} *blocked* — tests failed`;

    await notifySlack(slackMessage, {
      prNumber,
      owner,
      repo: repoName,
      authorLogin,
    });

    return {
      decision,
      reason,
      testsPassed: testResult.passed,
    };
  } catch (err) {
    console.error(`[GitHub] Error processing webhook:`, err);
    throw err;
  }
}