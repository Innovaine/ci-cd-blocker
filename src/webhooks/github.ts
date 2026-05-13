import type { RepoConfig } from '../config/repo-config.js';
import { loadRepoConfig } from '../config/repo-config.js';
import { saveDecision } from '../db/decisions.js';
import type { DecisionRecord } from '../db/decisions.js';
import { orchestrateTests } from '../test/orchestrator.js';

export interface WebhookPayload {
  action?: string;
  pull_request?: {
    number: number;
    head: {
      repo?: {
        name: string;
        owner: { login: string };
      };
    };
    title: string;
  };
  repository?: {
    name: string;
    owner: { login: string };
  };
}

export interface WebhookResult {
  success: boolean;
  decision?: DecisionRecord;
  error?: string;
}

export async function handleGitHubWebhook(
  payload: WebhookPayload
): Promise<WebhookResult> {
  // ASSUMPTION: Only handle 'opened' and 'synchronize' actions.
  // 'opened' = new PR, 'synchronize' = commit pushed to existing PR.
  if (
    !payload.pull_request ||
    !['opened', 'synchronize'].includes(payload.action || '')
  ) {
    return { success: true };
  }

  const pr = payload.pull_request;
  const owner = pr.head.repo?.owner.login || payload.repository?.owner.login;
  const repo = pr.head.repo?.name || payload.repository?.name;
  const prNumber = pr.number;

  if (!owner || !repo) {
    return {
      success: false,
      error: 'Could not determine owner/repo from payload',
    };
  }

  try {
    // Load repo-specific config (staging URL, integration test command, etc.).
    const config = await loadRepoConfig(owner, repo);

    // Run integration tests against the staging environment.
    const testResult = await orchestrateTests({
      prNumber,
      owner,
      repo,
      stagingUrl: config.stagingUrl,
    });

    // Record the decision.
    const decision: DecisionRecord = {
      id: `gh-${Date.now()}`,
      timestamp: new Date().toISOString(),
      owner,
      repo,
      prNumber,
      status: testResult.passed ? 'approved' : 'blocked',
      reason: testResult.passed ? 'All tests passed' : testResult.error || 'Integration tests failed',
      testsPassed: testResult.passed,
      integrationTestUrl: config.stagingUrl,
    };

    await saveDecision(decision);

    return { success: true, decision };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Webhook error for ${owner}/${repo}#${prNumber}:`, errorMessage);
    return { success: false, error: errorMessage };
  }
}