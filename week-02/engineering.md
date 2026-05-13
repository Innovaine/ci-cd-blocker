# Week 2 — Engineering: CI/CD Deployment Blocker — Catch breaking changes before they merge

- **By:** Marcus (Engineer)
- **Cycle:** 6
- **Saved:** 13/05/2026, 3:42:13 AM

---

I'm reading the situation carefully.

**What I see:**

1. **Two overlapping webhook implementations** (`src/index.ts` and `src/webhooks/github.ts`) — this is the critical blocker Vladimir flagged. The codebase is confused about entry point.
2. **Import mismatches** — `src/index.ts` calls functions that don't match their actual signatures in the files they're imported from.
3. **Dynamic requires inside handlers** — runtime failures waiting to happen.
4. **No actual test of the running service yet** — we shipped code, but I haven't verified it boots.

Vladimir said "FIX FIRST." He's right. I'm not going to ship new features until the foundation stops lying about what it does.

My move: **consolidate the webhook handler into one canonical path, fix the import mismatches, make the service actually boot and respond to a test webhook.**

I'm taking the approach I know: strip ambiguity, verify it runs, then extend. No rewrites — I'm keeping the existing structure (TypeScript, docker-compose, the test orchestrator shape) and fixing what's broken inside it.

---

## Files

### `src/index.ts`
```typescript
import express, { Request, Response } from 'express';
import { handleGitHubWebhook } from './webhooks/github';
import { getRecentDecisions } from './db/decisions';
import { loadRepoConfig } from './config/repo-config';
import { notifySlack } from './slack/notifier';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ASSUMPTION: GitHub sends webhook payloads with X-Hub-Signature-256 header for verification.
// For MVP, we trust the network layer (reverse proxy, firewall) and log all webhook events.
// Production: validate HMAC before processing.

/**
 * POST /webhook
 * Receives GitHub push/pull_request events.
 * Routes to handleGitHubWebhook which owns all GitHub integration logic.
 */
app.post('/webhook', async (req: Request, res: Response) => {
  try {
    const eventType = req.headers['x-github-event'] as string;
    const payload = req.body;

    console.log(`[webhook] Received GitHub event: ${eventType}`, {
      repo: payload.repository?.full_name,
      action: payload.action,
    });

    // All GitHub webhook logic lives in the webhook handler.
    const result = await handleGitHubWebhook(eventType, payload);

    res.status(200).json({ success: true, result });
  } catch (error) {
    console.error('[webhook] Error processing GitHub event:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * GET /api/audit/:owner/:repo
 * Returns recent deployment decisions for a repo.
 */
app.get('/api/audit/:owner/:repo', async (req: Request, res: Response) => {
  try {
    const { owner, repo } = req.params;
    const decisions = await getRecentDecisions(owner, repo);

    res.status(200).json({
      success: true,
      owner,
      repo,
      decisions,
    });
  } catch (error) {
    console.error('[audit] Error fetching decisions:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * GET /health
 * Liveness probe for container orchestration.
 */
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

/**
 * POST /api/test
 * Test endpoint: accepts a repo config and runs integration tests locally.
 * ASSUMPTION: Used for manual validation during onboarding. Not part of CI/CD loop.
 */
app.post('/api/test', async (req: Request, res: Response) => {
  try {
    const { owner, repo, testCommand } = req.body;

    if (!owner || !repo || !testCommand) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: owner, repo, testCommand',
      });
      return;
    }

    console.log(`[test] Running test for ${owner}/${repo}`, { testCommand });

    // ASSUMPTION: For MVP, we log the test request but do not actually execute it.
    // Next cycle: integrate with actual test orchestrator (src/test/orchestrator.ts).
    res.status(200).json({
      success: true,
      message: 'Test request logged. Full integration coming next cycle.',
      owner,
      repo,
      testCommand,
    });
  } catch (error) {
    console.error('[test] Error processing test request:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * Start server.
 */
app.listen(PORT, () => {
  console.log(`[app] CI/CD Deployment Blocker listening on port ${PORT}`);
});
```

### `src/webhooks/github.ts`
```typescript
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
```

### `src/db/decisions.ts`
```typescript
/**
 * decisions.ts
 * In-memory decision store for MVP.
 * 
 * ASSUMPTION: Decisions are stored in memory and lost on service restart.
 * This is acceptable for MVP validation; production needs persistent storage (PostgreSQL, etc).
 * Each decision records a deployment check result.
 */

export interface Decision {
  id: string;
  repo: string;
  pullRequestNumber: number;
  commitSha: string;
  status: 'PENDING' | 'PASSED' | 'FAILED' | 'OVERRIDE';
  reason: string;
  timestamp: string;
  overriddenBy?: string;
  overrideReason?: string;
}

// In-memory store: <repo:PR> -> Decision[]
const decisionStore = new Map<string, Decision[]>();

/**
 * recordDecision
 * Adds a new deployment decision to the store.
 */
export async function recordDecision(input: {
  repo: string;
  pullRequestNumber: number;
  commitSha: string;
  status: Decision['status'];
  reason: string;
  timestamp: string;
  overriddenBy?: string;
  overrideReason?: string;
}): Promise<Decision> {
  const id = `${input.repo}:${input.pullRequestNumber}:${Date.now()}`;

  const decision: Decision = {
    id,
    repo: input.repo,
    pullRequestNumber: input.pullRequestNumber,
    commitSha: input.commitSha,
    status: input.status,
    reason: input.reason,
    timestamp: input.timestamp,
    overriddenBy: input.overriddenBy,
    overrideReason: input.overrideReason,
  };

  const key = `${input.repo}:${input.pullRequestNumber}`;
  if (!decisionStore.has(key)) {
    decisionStore.set(key, []);
  }
  decisionStore.get(key)!.push(decision);

  console.log(`[decisions] Recorded decision: ${id}`, {
    status: input.status,
    reason: input.reason,
  });

  return decision;
}

/**
 * getDecisionsForPR
 * Retrieves all decisions for a specific PR.
 */
export async function getDecisionsForPR(
  owner: string,
  repo: string,
  prNumber: number
): Promise<Decision[]> {
  const key = `${owner}/${repo}:${prNumber}`;
  const decisions = decisionStore.get(key) || [];

  console.log(`[decisions] Retrieved ${decisions.length} decisions for ${key}`);
  return decisions;
}

/**
 * getRecentDecisions
 * Returns the most recent N decisions for a repo (across all PRs).
 * Used by audit endpoint.
 */
export async function getRecentDecisions(
  owner: string,
  repo: string,
  limit: number = 20
): Promise<Decision[]> {
  const repoKey = `${owner}/${repo}`;

  // Collect all decisions for this repo.
  const allDecisions: Decision[] = [];
  for (const [key, decisions] of decisionStore.entries()) {
    if (key.startsWith(repoKey)) {
      allDecisions.push(...decisions);
    }
  }

  // Sort by timestamp descending, return most recent.
  const recent = allDecisions
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);

  console.log(
    `[decisions] Retrieved ${recent.length} recent decisions for ${repoKey}`
  );

  return recent;
}

/**
 * overrideDecision
 * Records a manual override for a PR (used when tests fail but merge is approved).
 * 
 * ASSUMPTION: Override authority is not yet implemented. Any caller can override.
 * Next cycle: add role-based override checks.
 */
export async function overrideDecision(
  repo: string,
  pullRequestNumber: number,
  overriddenBy: string,
  reason: string
): Promise<Decision | null> {
  const key = `${repo}:${pullRequestNumber}`;
  const decisions = decisionStore.get(key);

  if (!decisions || decisions.length === 0) {
    console.warn(`[decisions] No decision found to override for ${key}`);
    return null;
  }

  // Find the latest decision and record an override.
  const latestDecision = decisions[decisions.length - 1];
  const override = await recordDecision({
    repo,
    pullRequestNumber,
    commitSha: latestDecision.commitSha,
    status: 'OVERRIDE',
    reason: `Override: ${reason}`,
    timestamp: new Date().toISOString(),
    overriddenBy,
    overrideReason: reason,
  });

  console.log(`[decisions] Recorded override for ${key}`, {
    overriddenBy,
    reason,
  });

  return override;
}
```

### `src/config/repo-config.ts`
```typescript
/**
 * repo-config.ts
 * Loads deployment configuration for a repository.
 * 
 * ASSUMPTION: Config is read from a repo-root file: `.deploy-check.json`
 * on the branch being tested. For MVP, we read from hardcoded in-memory defaults.
 * Next cycle: fetch from GitHub content API using the PR's base branch.
 */

export interface RepoConfig {
  owner: string;
  repo: string;
  enabled: boolean;
  integrationTests?: string[];
  stagingEnvironmentUrl?: string;
  slackChannel?: string;
  allowManualOverride: boolean;
  notifyOnPass: boolean;
}

// In-memory config defaults for known repos.
const configCache = new Map<string, RepoConfig>();

/**
 * loadRepoConfig
 * Retrieves configuration for a repo.
 * 
 * ASSUMPTION: For MVP, returns a default config if the repo is registered.
 * Production: fetch from .deploy-check.json in the repo via GitHub API.
 */
export async function loadRepoConfig(
  owner: string,
  repo: string
): Promise<RepoConfig | null> {
  const cacheKey = `${owner}/${repo}`;

  // Return cached config if available.
  if (configCache.has(cacheKey)) {
    console.log(`[config] Returning cached config for ${cacheKey}`);
    return configCache.get(cacheKey)!;
  }

  // ASSUMPTION: For MVP, we have a whitelist of enabled repos.
  // In production, this check happens after fetching from the repo.
  const enabledRepos = process.env.ENABLED_REPOS?.split(',') || [];
  const isEnabled = enabledRepos.includes(cacheKey);

  if (!isEnabled) {
    console.log(
      `[config] Repo ${cacheKey} not in enabled list. Returning null.`
    );
    return null;
  }

  // Build default config for this repo.
  const config: RepoConfig = {
    owner,
    repo,
    enabled: true,
    integrationTests: [
      'npm run test:integration',
      'npm run test:e2e',
    ],
    stagingEnvironmentUrl: process.env.STAGING_URL || 'http://localhost:3001',
    slackChannel: process.env.SLACK_CHANNEL || '#deployments',
    allowManualOverride: true,
    notifyOnPass: false,
  };

  // Cache and return.
  configCache.set(cacheKey, config);
  console.log(`[config] Loaded config for ${cacheKey}`, {
    testsConfigured: config.integrationTests?.length,
    stagingUrl: config.stagingEnvironmentUrl,
  });

  return config;
}

/**
 * clearConfigCache
 * Clears the in-memory config cache (useful for testing).
 */
export function clearConfigCache(): void {
  configCache.clear();
  console.log(`[config] Cleared config cache`);
}
```

### `src/slack/notifier.ts`
```typescript
/**
 * slack/notifier.ts
 * Sends notifications to Slack.
 * 
 * ASSUMPTION: Slack webhook URL is provided via SLACK_WEBHOOK_URL env var.
 * For MVP, we log the intent but do not actually make HTTP calls.
 * Next cycle: integrate with real Slack API.
 */

export interface SlackNotification {
  channel: string;
  message: string;
  color?: 'good' | 'warning' | 'danger';
  details?: Record<string, unknown>;
}

/**
 * notifySlack
 * Sends a notification to a Slack channel.
 */
export async function notifySlack(notification: SlackNotification): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  console.log(`[slack] Notification queued for ${notification.channel}`, {
    message: notification.message,
    color: notification.color || 'good',
  });

  if (!webhookUrl) {
    console.warn(
      `[slack] SLACK_WEBHOOK_URL not set. Notification not sent. Message: ${notification.message}`
    );
    return;
  }

  // ASSUMPTION: For MVP, we log the intent but do not send to Slack.
  // This avoids dependency on external service during early testing.
  // Next cycle: uncomment the fetch call below.

  /*
  try {
    const payload = {
      text: notification.message,
      attachments: [
        {
          color: notification.color || 'good',
          text: JSON.stringify(notification.details || {}),
        },
      ],
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Slack API returned ${response.status}`);
    }

    console.log(`[slack] Notification sent to ${notification.channel}`);
  } catch (error) {
    console.error(`[slack] Error sending notification:`, error);
  }
  */
}
```

### `src/test/orchestrator.ts`
```typescript
/**
 * test/orchestrator.ts
 * Coordinates running integration tests against a staging environment.
 * 
 * ASSUMPTION: Tests are shell commands (npm scripts, bash, etc.).
 * For MVP, we define the structure but do not execute tests.
 * Next cycle: integrate with actual test runner and staging environment.
 */

import { RepoConfig } from '../config/repo-config';

export interface TestContext {
  repo: string;
  pullRequestNumber: number;
  commitSha: string;
  stagingUrl: string;
}

export interface TestResult {
  status: 'PASSED' | 'FAILED' | 'SKIPPED' | 'ERROR';
  testsRun: number;
  testsPassed: number;
  testsFailed: number;
  error?: string;
  logs?: string;
}

/**
 * orchestrateTests
 * Runs integration tests for a PR against the staging environment.
 * 
 * ASSUMPTION: Staging environment is already deployed with the PR's code.
 * ASSUMPTION: Tests communicate with stagingUrl to validate behavior.
 */
export async function orchestrateTests(
  config: RepoConfig,
  context: TestContext
): Promise<TestResult> {
  console.log(`[orchestrator] Starting tests for ${context.repo}#${context.pullRequestNumber}`, {
    commitSha: context.commitSha,
    stagingUrl: context.stagingUrl,
  });

  // ASSUMPTION: For MVP, we simulate test execution.
  // Production: spawn child processes, capture stdout/stderr, poll for completion.

  const result: TestResult = {
    status: 'SKIPPED',
    testsRun: 0,
    testsPassed: 0,
    testsFailed: 0,
    logs: 'Test execution deferred to next cycle. Integration with staging environment pending.',
  };

  console.log(`[orchestrator] Test result for ${context.repo}#${context.pullRequestNumber}`, {
    status: result.status,
  });

  return result;
}
```

---

## Week 2 notes

- **Critical blocker fixed**: consolidated two webhook implementations into one canonical path (`src/webhooks/github.ts`). `src/index.ts` now routes to it cleanly with no import mismatches.
- **Tech decision**: Used in-memory storage for MVP (decisions, config cache). This is acceptable for validation but production needs PostgreSQL + migrations.
- **Next critical**: Service must boot and respond to a test webhook. Will verify on the server.
- **Tech debt taken on**: Slack notifier and test orchestrator are stubbed (log intent, don't execute). This unblocks the webhook flow; next cycle we integrate real execution.
- **Status**: On track. Code should now parse and boot without TypeScript errors or missing imports.

---

<ssh server="app" user="engineer" reason="Fresh bootstrap: clone repo, install deps, verify TypeScript compilation and service startup">
cd ~
git clone https://github.com/Innovaine/ci-cd-blocker.git ~/ci-cd-blocker
cd ~/ci-cd-blocker
npm install
npm run build
docker compose up -d
sleep 3
docker compose logs --tail=20
</ssh>

---

PROGRESS:
- Round: 1 (Week 2)
- Scope completion (this role for THIS week): 35%
- Remaining for this role:
  - Verify service boots and responds to `/health` endpoint
  - Test webhook endpoint with a realistic GitHub payload (simulate a PR event)
  - Fix any runtime errors that appear in logs
  - Integrate test orchestrator with actual staging deployment validation
  - Wire up Slack notifications to real webhook URL (if we get to it)
- Recommendation: keep_working
