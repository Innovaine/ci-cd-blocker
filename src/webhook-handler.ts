import { WebhookPayload, WebhookResult } from './webhooks/github';
import { orchestrateTests, TestContext } from './test/orchestrator';
import { RepoConfig, loadRepoConfig } from './config/repo-config';
import { recordDecision, Decision } from './db/decisions';
import { notifySlack } from './slack/notifier';

export async function handleWebhook(payload: WebhookPayload): Promise<WebhookResult> {
  // Check if this is a PR opened/synchronize event
  if (!payload.action || !['opened', 'synchronize'].includes(payload.action)) {
    return { success: true, decision: { status: 'skipped', reason: 'Not a PR open/sync event' } };
  }

  if (!payload.pull_request) {
    return { success: false, error: 'No pull_request in payload' };
  }

  const pr = payload.pull_request;
  const prNumber = pr.number;
  const owner = pr.base?.repo?.owner?.login || 'unknown';
  const repo = pr.base?.repo?.name || 'unknown';

  console.log(`[webhook] Processing ${owner}/${repo}#${prNumber}`);

  // Load repo config (or use defaults)
  let config: RepoConfig;
  try {
    config = loadRepoConfig(owner, repo);
  } catch {
    config = {
      owner,
      repo,
      stagingUrl: `https://staging-${owner}-${repo}.example.com`,
      testCommand: 'npm test',
      slackChannel: '#ci-blockers',
      overrideAllowed: true,
    };
  }

  // Run integration tests against staging
  let testResult;
  try {
    testResult = await orchestrateTests(config, { prNumber, headSha: pr.head?.sha || 'unknown' });
  } catch (e) {
    console.error(`Test orchestration failed for ${owner}/${repo}#${prNumber}`, e);
    testResult = { passed: false, errors: [String(e)] };
  }

  // Record decision
  const decision: Decision = {
    id: `decision-${Date.now()}`,
    owner,
    repo,
    prNumber,
    status: testResult.passed ? 'approved' : 'blocked',
    reason: testResult.passed ? 'Tests passed' : `Tests failed: ${testResult.errors?.join('; ') || 'unknown error'}`,
    createdAt: new Date().toISOString(),
  };

  recordDecision(decision);

  // Notify Slack
  try {
    await notifySlack(config.slackChannel, decision);
  } catch (e) {
    console.warn(`Slack notification failed for ${owner}/${repo}#${prNumber}`, e);
  }

  return {
    success: true,
    decision: {
      status: decision.status as 'approved' | 'blocked' | 'approved_override' | 'skipped',
      reason: decision.reason,
    },
  };
}