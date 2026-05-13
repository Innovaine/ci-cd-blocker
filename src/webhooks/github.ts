import { RepoConfig } from '../config/repo-config';
import { orchestrateTests } from '../test/orchestrator';

// GitHub webhook payload shape (simplified for MVP).
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

// Result of webhook processing.
export interface WebhookHandlerResult {
  testsPassed: boolean;
  message: string;
}

/**
 * Handle incoming GitHub webhook event.
 * Decides whether to block or allow a PR based on integration test results.
 */
export async function handleGitHubWebhook(
  payload: GitHubWebhookPayload,
  config: RepoConfig
): Promise<WebhookHandlerResult> {
  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;
  const prNumber = payload.pull_request.number;

  console.log(`[GitHub] Received webhook for ${owner}/${repo} PR #${prNumber}`);

  // Only process 'opened' and 'synchronize' actions (new PR or push to existing PR).
  if (payload.action !== 'opened' && payload.action !== 'synchronize') {
    console.log(`[GitHub] Skipping action "${payload.action}" — only process opened/synchronize`);
    return {
      testsPassed: true,
      message: 'Skipped (action not relevant)',
    };
  }

  try {
    // Run integration tests against staging environment.
    const testResult = await orchestrateTests(config, prNumber);

    console.log(
      `[GitHub] Tests for ${owner}/${repo} PR #${prNumber}: ${testResult.testsPassed ? 'PASS' : 'FAIL'}`
    );

    return {
      testsPassed: testResult.testsPassed,
      message: testResult.testsPassed ? 'Tests passed' : 'Tests failed',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[GitHub] Error running tests: ${message}`);
    // ASSUMPTION: On test orchestration failure, default to FAIL (conservative: block the merge).
    return {
      testsPassed: false,
      message: `Test execution error: ${message}`,
    };
  }
}