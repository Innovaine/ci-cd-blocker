import { Request } from 'express';
import { recordDecision, Decision } from '../db/decisions';
import { notifySlack } from '../slack/notifier';
import { loadRepoConfig } from '../config/repo-config';
import { orchestrateTests } from '../test/orchestrator';

export async function handleGitHubWebhook(payload: any): Promise<Decision> {
  // ASSUMPTION: Only handle "opened" actions for PRs. Ignore other events.
  if (payload.action !== 'opened' || !payload.pull_request) {
    return {
      id: `skip-${Date.now()}`,
      owner: '',
      repo: '',
      prNumber: 0,
      status: 'skipped',
      reason: 'Not a PR open event',
      createdAt: new Date().toISOString(),
    };
  }

  const pr = payload.pull_request;
  const owner = pr.head?.repo?.owner?.login || payload.repository?.owner?.login;
  const repo = pr.head?.repo?.name || payload.repository?.name;
  const prNumber = pr.number;

  // Load repo config (stagingUrl, testCommand, slackChannel, etc.)
  let config;
  try {
    config = loadRepoConfig(owner, repo);
  } catch (e) {
    console.warn(`No config found for ${owner}/${repo}, using defaults`, e);
    config = {
      owner,
      repo,
      stagingUrl: 'http://localhost:8000',
      testCommand: 'npm test',
      slackChannel: '#ci-blockers',
      overrideAllowed: true,
    };
  }

  // Run integration tests against staging
  let testResult;
  try {
    testResult = await orchestrateTests(config, { prNumber, headSha: pr.head?.sha });
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

  return decision;
}