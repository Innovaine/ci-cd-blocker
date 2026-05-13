import { loadRepoConfig } from '../config/repo-config';
import { orchestrateTests } from '../test/orchestrator';
import { recordDecision, getDecisionsForPR } from '../db/decisions';
import { notifySlack } from '../slack/notifier';

export interface GitHubWebhookPayload {
  action?: string;
  pull_request?: {
    number: number;
    head: { sha: string; ref: string };
    base: { ref: string };
    title: string;
    draft?: boolean;
  };
  repository?: {
    name: string;
    owner: { login: string };
  };
}

export interface WebhookDecision {
  prNumber: number;
  owner: string;
  repo: string;
  allowed: boolean;
  reason: string;
  timestamp: string;
}

// ASSUMPTION: Only process pull_request opened/synchronize events
// Draft PRs are skipped (no tests run until marked ready for review)
export async function handleGitHubWebhook(payload: GitHubWebhookPayload): Promise<WebhookDecision> {
  const { action, pull_request, repository } = payload;

  if (!pull_request || !repository) {
    throw new Error('Invalid webhook payload: missing pull_request or repository');
  }

  const prNumber = pull_request.number;
  const owner = repository.owner.login;
  const repo = repository.name;
  const isDraft = pull_request.draft === true;

  console.log(`[GitHub] Webhook: ${action} PR #${prNumber} in ${owner}/${repo} (draft=${isDraft})`);

  // Skip draft PRs
  if (isDraft) {
    console.log(`[GitHub] Skipping draft PR #${prNumber}`);
    return {
      prNumber,
      owner,
      repo,
      allowed: true,
      reason: 'PR is in draft; skipping tests',
      timestamp: new Date().toISOString(),
    };
  }

  // Only process opened and synchronize (push to PR)
  if (!['opened', 'synchronize'].includes(action || '')) {
    console.log(`[GitHub] Ignoring action: ${action}`);
    return {
      prNumber,
      owner,
      repo,
      allowed: true,
      reason: `Action ${action} does not trigger tests`,
      timestamp: new Date().toISOString(),
    };
  }

  try {
    // Check if decision already exists (idempotency)
    const existing = getDecisionsForPR(owner, repo, prNumber);
    if (existing && existing.commitSha === pull_request.head.sha) {
      console.log(`[GitHub] Decision already exists for this commit; returning cached decision`);
      return {
        prNumber,
        owner,
        repo,
        allowed: existing.allowed,
        reason: existing.reason,
        timestamp: existing.timestamp,
      };
    }

    // Load config for this repo
    const config = await loadRepoConfig(owner, repo);

    // Run integration tests
    console.log(`[GitHub] Running integration tests against ${config.stagingUrl}`);
    const testResult = await orchestrateTests(config, {
      prNumber,
      commitSha: pull_request.head.sha,
      branchName: pull_request.head.ref,
    });

    const allowed = testResult.passed;
    const reason = allowed ? 'All integration tests passed' : `Tests failed: ${testResult.failureReason || 'unknown'}`;

    // Record decision
    const decision = {
      prNumber,
      owner,
      repo,
      commitSha: pull_request.head.sha,
      branchName: pull_request.head.ref,
      allowed,
      reason,
      timestamp: new Date().toISOString(),
      testDuration: testResult.durationMs,
    };

    recordDecision(decision);

    // Notify Slack
    await notifySlack({
      channel: config.slackChannel,
      message: allowed
        ? `✅ PR #${prNumber} in ${owner}/${repo} passed integration tests`
        : `❌ PR #${prNumber} in ${owner}/${repo} failed integration tests`,
      details: {
        'PR Title': pull_request.title,
        'Commit SHA': pull_request.head.sha.substring(0, 7),
        'Test Duration': `${testResult.durationMs}ms`,
        Reason: reason,
      },
    });

    return { prNumber, owner, repo, allowed, reason, timestamp: decision.timestamp };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[GitHub] Error processing webhook: ${errorMsg}`);

    // Record failure decision
    const decision = {
      prNumber,
      owner,
      repo,
      commitSha: pull_request.head.sha,
      branchName: pull_request.head.ref,
      allowed: false,
      reason: `Webhook handler error: ${errorMsg}`,
      timestamp: new Date().toISOString(),
      testDuration: 0,
    };

    recordDecision(decision);

    // Notify Slack of failure
    await notifySlack({
      channel: process.env.SLACK_CHANNEL || '#deployments',
      message: `⚠️ PR #${prNumber} in ${owner}/${repo} could not be evaluated — webhook handler error`,
      details: { Error: errorMsg },
    });

    return {
      prNumber,
      owner,
      repo,
      allowed: false,
      reason: `Webhook handler error: ${errorMsg}`,
      timestamp: new Date().toISOString(),
    };
  }
}