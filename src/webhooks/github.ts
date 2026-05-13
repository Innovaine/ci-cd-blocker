import { RepoConfig, loadRepoConfig } from '../config/repo-config';
import { orchestrateTests, TestContext } from '../test/orchestrator';
import { recordDecision } from '../db/decisions';
import { notifySlack } from '../slack/notifier';

export interface GitHubPullRequestPayload {
  action: string;
  pull_request: {
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
 * Handle GitHub pull_request webhook event.
 * 1. Load repo config
 * 2. Orchestrate integration tests
 * 3. Record decision
 * 4. Notify Slack
 * 5. Return result
 *
 * ASSUMPTION: Tests are orchestrated synchronously. After first paying customer, add timeout + async queue.
 */
export async function handleGitHubWebhook(payload: GitHubPullRequestPayload) {
  const { pull_request } = payload;
  const { number: prNumber, head, base } = pull_request;
  const owner = base.repo.owner.login;
  const repoName = base.repo.name;

  console.log(`[github-webhook] ${owner}/${repoName}#${prNumber} opened`);

  try {
    // Load config for this repo
    const config: RepoConfig | null = loadRepoConfig(owner, repoName);

    if (!config) {
      console.warn(`[github-webhook] No config for ${owner}/${repoName}, skipping`);
      return { blocked: false, reason: 'no-config' };
    }

    // Build test context
    const testContext: TestContext = {
      prNumber,
      headSha: head.sha,
      headRef: head.ref,
      baseSha: base.sha,
      baseRef: base.ref,
      owner,
      repo: repoName,
    };

    // Run tests
    const testResult = await orchestrateTests(config, testContext);

    // Determine if we should block
    const shouldBlock = !testResult.passed;

    // Record decision
    recordDecision({
      owner,
      repo: repoName,
      prNumber,
      decision: shouldBlock ? 'blocked' : 'approved',
      reason: testResult.passed ? 'tests-passed' : 'tests-failed',
      timestamp: new Date().toISOString(),
    });

    // Notify Slack (stub — no-op if SLACK_WEBHOOK_URL not set)
    if (shouldBlock) {
      await notifySlack({
        owner,
        repo: repoName,
        prNumber,
        status: 'blocked',
        reason: testResult.reason || 'integration tests failed',
      });
    }

    return {
      blocked: shouldBlock,
      prNumber,
      owner,
      repo: repoName,
      testsPassed: testResult.passed,
      reason: testResult.reason,
    };
  } catch (err) {
    console.error(`[github-webhook] Error handling ${owner}/${repoName}#${prNumber}:`, err);

    // Record failure
    recordDecision({
      owner,
      repo: repoName,
      prNumber,
      decision: 'error',
      reason: String(err),
      timestamp: new Date().toISOString(),
    });

    return { blocked: false, error: String(err) };
  }
}