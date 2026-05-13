import { loadRepoConfig } from '../config/repo-config';
import { notifySlack } from '../slack/notifier';
import { recordDecision } from '../db/decisions';

export interface GitHubWebhookPayload {
  action?: string;
  pull_request?: {
    number: number;
    title: string;
    head: {
      sha: string;
      ref: string;
    };
    base: {
      ref: string;
    };
    user?: {
      login: string;
    };
  };
  repository?: {
    full_name: string;
    owner?: {
      login: string;
    };
  };
  push?: {
    ref: string;
  };
}

export interface WebhookResult {
  event: string;
  action: string;
  status: 'processed' | 'skipped' | 'error';
  decision?: string;
  message?: string;
}

/**
 * handleGitHubWebhook
 * Single entry point for all GitHub webhook events.
 * Routes based on event type (pull_request, push, etc).
 * 
 * ASSUMPTION: MVP focuses on pull_request.opened and pull_request.synchronize.
 * Push events are logged but not acted upon in this cycle.
 */
export async function handleGitHubWebhook(
  eventType: string,
  payload: GitHubWebhookPayload
): Promise<WebhookResult> {
  const repoFullName = payload.repository?.full_name || 'unknown';

  console.log(`[github-webhook] Processing ${eventType} for ${repoFullName}`);

  try {
    // Route by event type.
    if (eventType === 'pull_request') {
      return await handlePullRequest(payload);
    } else if (eventType === 'push') {
      return await handlePush(payload);
    } else {
      console.log(
        `[github-webhook] Ignoring unhandled event type: ${eventType}`
      );
      return {
        event: eventType,
        action: 'ignored',
        status: 'skipped',
        message: `Event type ${eventType} not yet handled`,
      };
    }
  } catch (error) {
    console.error(`[github-webhook] Error processing ${eventType}:`, error);
    return {
      event: eventType,
      action: 'error',
      status: 'error',
      message: String(error),
    };
  }
}

/**
 * handlePullRequest
 * Triggered when a PR is opened or updated (synchronize).
 * 
 * ASSUMPTION: We only act on "opened" and "synchronize".
 * Other actions (closed, reopened, etc.) are logged but not processed.
 */
async function handlePullRequest(payload: GitHubWebhookPayload): Promise<WebhookResult> {
  const action = payload.action || 'unknown';
  const pr = payload.pull_request;
  const repo = payload.repository?.full_name || 'unknown';

  if (!pr) {
    return {
      event: 'pull_request',
      action,
      status: 'skipped',
      message: 'No PR object in payload',
    };
  }

  console.log(`[pull-request] ${action} on ${repo}#${pr.number}`, {
    title: pr.title,
    sha: pr.head.sha,
  });

  // Only process opened and synchronize (new code pushed to PR).
  if (!['opened', 'synchronize'].includes(action)) {
    console.log(`[pull-request] Skipping action: ${action}`);
    return {
      event: 'pull_request',
      action,
      status: 'skipped',
      message: `Action ${action} does not trigger integration tests`,
    };
  }

  try {
    // Extract owner/repo from full_name (e.g., "myorg/myrepo").
    const [owner, repoName] = repo.split('/');
    if (!owner || !repoName) {
      throw new Error(`Invalid repository full_name: ${repo}`);
    }

    // Load the repo's deployment config.
    const config = await loadRepoConfig(owner, repoName);
    if (!config) {
      console.log(
        `[pull-request] No config found for ${owner}/${repoName}. Skipping.`
      );
      return {
        event: 'pull_request',
        action,
        status: 'skipped',
        message: `No deployment config for ${repo}`,
      };
    }

    // ASSUMPTION: Integration tests are defined in config.integrationTests array.
    // For MVP, we log the intent but do not actually run tests.
    // Next cycle: call orchestrateTests(config, testContext) from src/test/orchestrator.ts
    console.log(
      `[pull-request] Would run integration tests for ${repo}#${pr.number}`,
      {
        testsConfigured: config.integrationTests?.length || 0,
      }
    );

    // Record the decision (attempted check).
    const decision = await recordDecision({
      repo,
      pullRequestNumber: pr.number,
      commitSha: pr.head.sha,
      status: 'PENDING',
      reason: 'Integration tests initiated',
      timestamp: new Date().toISOString(),
    });

    // Notify Slack of decision.
    await notifySlack({
      channel: config.slackChannel,
      message: `PR #${pr.number} in ${repo} — integration tests queued`,
      color: 'warning',
    });

    return {
      event: 'pull_request',
      action,
      status: 'processed',
      decision: decision?.id || 'unknown',
      message: `Integration tests initiated for PR #${pr.number}`,
    };
  } catch (error) {
    console.error(`[pull-request] Error processing PR:`, error);
    throw error;
  }
}

/**
 * handlePush
 * Triggered on push to any branch.
 * 
 * ASSUMPTION: MVP does not act on push events. They are logged for future use.
 */
async function handlePush(payload: GitHubWebhookPayload): Promise<WebhookResult> {
  const repo = payload.repository?.full_name || 'unknown';

  console.log(`[push] Received push event for ${repo}`);

  return {
    event: 'push',
    action: 'received',
    status: 'skipped',
    message: 'Push events not yet implemented in MVP',
  };
}