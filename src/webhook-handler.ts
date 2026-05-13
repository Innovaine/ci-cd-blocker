import { loadRepoConfig } from './config/repo-config';
import { orchestrateTests } from './test/orchestrator';
import { recordDecision, getDecisionsForPR } from './db/decisions';
import { notifySlack } from './slack/notifier';

export interface WebhookPayload {
  action?: string;
  pull_request?: {
    number: number;
    head: {
      sha: string;
      ref: string;
    };
    base: {
      ref: string;
    };
    title?: string;
    html_url?: string;
  };
  repository?: {
    name: string;
    owner: {
      login: string;
    };
    html_url?: string;
  };
}

export interface WebhookResult {
  received: boolean;
  prNumber?: number;
  owner?: string;
  repo?: string;
  decision?: string;
  reason?: string;
  testResult?: string;
  message: string;
}

export async function handleGitHubWebhook(payload: WebhookPayload): Promise<WebhookResult> {
  try {
    // Extract relevant fields
    const action = payload.action || 'unknown';
    const pr = payload.pull_request;
    const repo = payload.repository;

    if (!pr || !repo) {
      console.warn('[WEBHOOK] Missing PR or repo in payload');
      return {
        received: false,
        message: 'Missing pull_request or repository in payload',
      };
    }

    const prNumber = pr.number;
    const owner = repo.owner.login;
    const repoName = repo.name;
    const sha = pr.head.sha;

    console.log(`[WEBHOOK] Received event for ${owner}/${repoName}#${prNumber} (action: ${action})`);

    // Only process opened and synchronize (push to existing PR) actions
    if (action !== 'opened' && action !== 'synchronize') {
      console.log(`[WEBHOOK] Ignoring action: ${action}`);
      return {
        received: true,
        prNumber,
        owner,
        repo: repoName,
        message: `Action '${action}' ignored (only 'opened' and 'synchronize' trigger tests)`,
      };
    }

    // Load the repo's deployment blocker config
    const config = await loadRepoConfig(owner, repoName, sha);
    console.log(`[WEBHOOK] Loaded config: testCommand="${config.testCommand}"`);

    // Run integration tests
    console.log(`[WEBHOOK] Starting test orchestration for ${owner}/${repoName}@${sha.slice(0, 7)}`);
    const testResult = await orchestrateTests(config, { owner, repoName, sha, prNumber });

    // Determine decision: pass tests → approve, fail → block
    const decision = testResult.passed ? 'approved' : 'blocked';
    const reason = testResult.passed
      ? 'All integration tests passed'
      : `Integration tests failed: ${testResult.output.split('\n')[0]}`;

    console.log(`[WEBHOOK] Decision: ${decision} (${reason})`);

    // Record the decision in the audit log
    await recordDecision(owner, repoName, prNumber, {
      decision,
      reason,
      timestamp: new Date().toISOString(),
      source: 'webhook',
      testExitCode: testResult.exitCode,
      testDuration: testResult.duration,
    });

    // Notify Slack (if configured)
    if (config.notificationChannels && config.notificationChannels.length > 0) {
      for (const channel of config.notificationChannels) {
        await notifySlack({
          channel,
          owner,
          repo: repoName,
          prNumber,
          prTitle: pr.title || 'Untitled PR',
          prUrl: pr.html_url || `https://github.com/${owner}/${repoName}/pull/${prNumber}`,
          decision,
          reason,
        }).catch((err) => {
          console.warn(`[WEBHOOK] Slack notification failed for ${channel}:`, err.message);
        });
      }
    }

    return {
      received: true,
      prNumber,
      owner,
      repo: repoName,
      decision,
      reason,
      testResult: testResult.passed ? 'passed' : 'failed',
      message: `Webhook processed; decision: ${decision}`,
    };
  } catch (error) {
    const err = error as Error;
    console.error('[WEBHOOK] Error processing webhook:', err.message);
    return {
      received: false,
      message: `Webhook processing failed: ${err.message}`,
    };
  }
}