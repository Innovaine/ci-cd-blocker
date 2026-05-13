import { RepoConfig, loadRepoConfig } from '../config/repo-config';
import { orchestrateTests, TestContext, TestResult } from '../test/orchestrator';
import { recordDecision, Decision } from '../db/decisions';
import { notifySlack } from '../slack/notifier';

export interface GitHubWebhookPayload {
  action?: string;
  number?: number;
  pull_request?: {
    number: number;
    head: { sha: string; ref: string; repo: { name: string; owner: { login: string } } };
    base: { sha: string; ref: string };
    title: string;
    user: { login: string };
  };
  repository?: {
    name: string;
    owner: { login: string };
    full_name: string;
  };
  ref?: string;
}

export interface WebhookResult {
  decision: 'approved' | 'blocked' | 'error';
  prNumber?: number;
  sha?: string;
  reason?: string;
  testsPassed?: boolean;
  decisionId?: string;
}

export async function handleGitHubWebhook(payload: GitHubWebhookPayload): Promise<WebhookResult> {
  // ASSUMPTION: we only care about pull_request opened/synchronize and push to main
  // We ignore other event types (issues, releases, etc.)

  if (!payload.repository) {
    return { decision: 'error', reason: 'Missing repository info' };
  }

  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;

  // Load repo config to determine if this repo is monitored
  let config: RepoConfig;
  try {
    config = await loadRepoConfig(owner, repo);
  } catch (error) {
    console.warn(`No config found for ${owner}/${repo}, skipping`);
    return { decision: 'approved', reason: 'Repo not monitored' };
  }

  // Handle pull request events
  if (payload.pull_request && (payload.action === 'opened' || payload.action === 'synchronize')) {
    const prNumber = payload.pull_request.number;
    const sha = payload.pull_request.head.sha;

    console.log(`[PR #${prNumber}] Testing ${owner}/${repo} @ ${sha}`);

    // Prepare test context
    const testContext: TestContext = {
      owner,
      repo,
      prNumber,
      baseSha: payload.pull_request.base.sha,
      headSha: sha,
      branch: payload.pull_request.head.ref,
    };

    // Run integration tests against staging
    let testResult: TestResult;
    try {
      testResult = await orchestrateTests(config, testContext);
    } catch (error) {
      console.error(`[PR #${prNumber}] Test orchestration failed:`, error);
      await notifySlack({
        channel: config.slackChannel,
        message: `⚠️ [PR #${prNumber}] Test orchestration failed for ${owner}/${repo}. Check logs.`,
        details: { error: String(error) },
      });
      return {
        decision: 'error',
        prNumber,
        sha,
        reason: 'Test orchestration failed',
      };
    }

    // Record decision in database
    const decision: Decision = {
      prNumber,
      owner,
      repo,
      sha,
      timestamp: new Date().toISOString(),
      decision: testResult.passed ? 'approved' : 'blocked',
      reason: testResult.passed
        ? 'Integration tests passed'
        : `Integration tests failed: ${testResult.failureReason}`,
      testsPassed: testResult.passed,
    };

    recordDecision(decision);

    // Notify Slack of result
    const emojiStatus = testResult.passed ? '✅' : '❌';
    await notifySlack({
      channel: config.slackChannel,
      message: `${emojiStatus} [PR #${prNumber}] ${testResult.passed ? 'approved' : 'blocked'} — integration tests ${testResult.passed ? 'passed' : 'failed'}`,
      details: {
        repo: `${owner}/${repo}`,
        sha: sha.substring(0, 7),
        branch: payload.pull_request.head.ref,
        testsPassed: testResult.passed,
      },
    });

    // Return decision to caller
    return {
      decision: testResult.passed ? 'approved' : 'blocked',
      prNumber,
      sha,
      reason: decision.reason,
      testsPassed: testResult.passed,
      decisionId: decision.prNumber?.toString(), // ASSUMPTION: using prNumber as unique ID for now
    };
  }

  // ASSUMPTION: push events are informational only; we don't block main branch merges in this MVP
  // Future: add branch protection rule checks
  if (payload.ref === `refs/heads/${config.mainBranch || 'main'}`) {
    console.log(`[PUSH] ${owner}/${repo} @ ${payload.ref}`);
    return { decision: 'approved', reason: 'Push to main recorded' };
  }

  return { decision: 'approved', reason: 'Event not monitored' };
}