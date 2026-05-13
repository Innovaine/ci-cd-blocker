import { recordDecision, DecisionRecord } from '../db/decisions';
import { loadRepoConfig } from '../config/repo-config';
import { orchestrateTests } from '../test/orchestrator';

export interface GitHubWebhookPayload {
  action: string;
  pull_request: {
    number: number;
    head: {
      repo: {
        owner: {
          login: string;
        };
        name: string;
      };
    };
  };
  repository: {
    owner: {
      login: string;
    };
    name: string;
  };
}

export interface WebhookHandlerResult {
  decision: DecisionRecord | null;
  error?: string;
}

export async function handleGitHubWebhook(payload: GitHubWebhookPayload): Promise<WebhookHandlerResult> {
  try {
    const owner = payload.repository.owner.login;
    const repo = payload.repository.name;
    const prNumber = payload.pull_request.number;

    console.log(`[GitHub Webhook] Received: ${owner}/${repo} PR #${prNumber}, action: ${payload.action}`);

    // Only process opened and synchronize actions
    if (payload.action !== 'opened' && payload.action !== 'synchronize') {
      console.log(`[GitHub Webhook] Ignoring action: ${payload.action}`);
      return { decision: null };
    }

    // Load repo configuration
    const config = loadRepoConfig(owner, repo);

    // Orchestrate tests against staging
    console.log(`[GitHub Webhook] Running integration tests for ${owner}/${repo}`);
    const testResult = await orchestrateTests(config);

    // Record the decision
    const decision = recordDecision({
      owner,
      repo,
      prNumber,
      testsPassed: testResult.passed,
      overridden: false,
    });

    console.log(`[GitHub Webhook] Decision recorded: ${decision.id}`);
    return { decision };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[GitHub Webhook] Error processing webhook:', message);
    return { decision: null, error: message };
  }
}