import { loadRepoConfig } from '../config/repo-config';
import { orchestrateTests } from '../test/orchestrator';
import { recordDecision } from '../db/decisions';
import { notifySlack } from '../slack/notifier';

export interface GitHubWebhookPayload {
  action?: string;
  pull_request?: {
    number: number;
    head: {
      sha: string;
      ref: string;
      repo?: {
        name: string;
        owner?: {
          login: string;
        };
      };
    };
    base: {
      repo: {
        name: string;
        owner: {
          login: string;
        };
      };
    };
    title: string;
    user?: {
      login: string;
    };
  };
  repository?: {
    name: string;
    owner: {
      login: string;
    };
    full_name: string;
  };
}

export async function handleGitHubPullRequestEvent(
  payload: GitHubWebhookPayload
): Promise<{ approved: boolean; reason: string }> {
  // Only care about opened and synchronize (new commits pushed)
  if (payload.action !== 'opened' && payload.action !== 'synchronize') {
    return { approved: true, reason: 'Not a test-triggering action' };
  }

  if (!payload.pull_request || !payload.repository) {
    return { approved: true, reason: 'Malformed payload' };
  }

  const {
    number: prNumber,
    head: { sha: commitSha, repo: headRepo },
    base: { repo: baseRepo },
    title: prTitle,
    user: { login: authorLogin } = {},
  } = payload.pull_request;

  const owner = baseRepo.owner.login;
  const repo = baseRepo.name;

  console.log(
    `[GitHub] PR #${prNumber} opened/updated in ${owner}/${repo} at ${commitSha}`
  );

  // Load repo config (defines staging URL, test paths, etc.)
  let config: any;
  try {
    config = await loadRepoConfig(owner, repo);
  } catch (err) {
    console.error(`Config load failed for ${owner}/${repo}:`, err);
    // If config is missing, assume tests should run
    config = { stagingUrl: 'http://localhost:3001', testPaths: ['./test'] };
  }

  // Run integration tests against staging
  let testResult: any;
  try {
    testResult = await orchestrateTests(config, {
      prNumber,
      commitSha,
      owner,
      repo,
      authorLogin,
    });
  } catch (err) {
    console.error(`Test orchestration failed for PR #${prNumber}:`, err);
    testResult = { passed: false, failureReason: String(err) };
  }

  const approved = testResult.passed === true;
  const reason = approved ? 'All tests passed' : testResult.failureReason || 'Tests failed';

  // Record decision in database
  try {
    await recordDecision({
      owner,
      repo,
      prNumber,
      commitSha,
      decision: approved ? 'approved' : 'blocked',
      reason,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error(`Failed to record decision for PR #${prNumber}:`, err);
  }

  // Notify Slack
  try {
    const slackMessage = approved
      ? `✅ PR #${prNumber} in ${owner}/${repo} approved (tests passed). Merge ready.`
      : `🚫 PR #${prNumber} in ${owner}/${repo} blocked. ${reason}`;

    await notifySlack(slackMessage, { prNumber, owner, repo, authorLogin });
  } catch (err) {
    console.error(`Slack notification failed for PR #${prNumber}:`, err);
  }

  return { approved, reason };
}