import express, { Request, Response } from 'express';
import { Octokit } from '@octokit/rest';
import crypto from 'crypto';
import { initializeDatabase, closeDatabase } from './db/schema';
import { recordDecision, recordOverride } from './db/decisions';
import { logger } from './utils/logger';
import { getRepoConfig } from './config/repo-config';
import { orchestrateTests, TestContext } from './test/orchestrator';
import {
  notifyBlockedPR,
  notifyOverriddenPR,
  notifyTestError,
} from './notifications/slack';
import { applyOverride, OverrideRequest } from './auth/override';
import { setCommitStatusAfterOverride } from './integrations/github';

const app = express();
const port = process.env.PORT || 3000;
const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET || '';

app.use(express.json());

// Initialize database on startup
initializeDatabase();

// Webhook payload signature verification
function verifyWebhookSignature(payload: string, signature: string): boolean {
  if (!webhookSecret) {
    logger.warn('GITHUB_WEBHOOK_SECRET not set; skipping signature verification');
    return true;
  }

  const hmac = crypto.createHmac('sha256', webhookSecret);
  hmac.update(payload);
  const expectedSignature = `sha256=${hmac.digest('hex')}`;

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Webhook endpoint
// GitHub sends: pull_request.opened, pull_request.synchronize
app.post('/webhook', async (req: Request, res: Response) => {
  const signature = req.headers['x-hub-signature-256'] as string;
  const rawBody = JSON.stringify(req.body);

  // ASSUMPTION: We verify signature for security. If missing/invalid, reject.
  if (!verifyWebhookSignature(rawBody, signature)) {
    logger.warn('Webhook signature verification failed');
    res.status(403).json({ error: 'Unauthorized' });
    return;
  }

  const { action, pull_request } = req.body;

  // Only process opened and synchronize (new commits) events
  if (!action || !['opened', 'synchronize'].includes(action)) {
    res.status(200).json({ message: 'Event ignored' });
    return;
  }

  if (!pull_request) {
    res.status(400).json({ error: 'Missing pull_request in payload' });
    return;
  }

  const owner = pull_request.head.repo?.owner?.login;
  const repo = pull_request.head.repo?.name;
  const prNumber = pull_request.number;
  const headSha = pull_request.head.sha;
  const baseRef = pull_request.base.ref;

  if (!owner || !repo || !headSha || !baseRef) {
    logger.error('Webhook payload missing required fields');
    res.status(400).json({ error: 'Missing required fields in pull_request' });
    return;
  }

  try {
    logger.info(`Processing webhook for ${owner}/${repo}#${prNumber}`);

    const config = getRepoConfig(owner, repo);
    const testContext: TestContext = {
      owner,
      repo,
      prNumber,
      headSha,
      baseRef,
    };

    // Orchestrate tests against staging
    const testResult = await orchestrateTests(config, testContext);

    // Record decision in database
    const blocked = !testResult.passed;
    const failureCount = testResult.failures.length;

    recordDecision({
      owner,
      repo,
      pr_number: prNumber,
      head_sha: headSha,
      decision: blocked ? 'blocked' : 'passed',
      test_passed: testResult.passed,
      failure_count: failureCount,
      failure_details: testResult.failures,
    });

    // Set commit status on GitHub
    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

    const state = blocked ? 'failure' : 'success';
    const description = blocked
      ? `Integration tests failed (${failureCount} failure${failureCount !== 1 ? 's' : ''})`
      : 'Integration tests passed';

    await octokit.repos.createCommitStatus({
      owner,
      repo,
      sha: headSha,
      state,
      description,
      context: 'ci-cd-blocker/integration-tests',
    });

    // If blocked, notify Slack
    if (blocked) {
      await notifyBlockedPR({
        owner,
        repo,
        prNumber,
        prTitle: pull_request.title,
        prAuthor: pull_request.user.login,
        failureCount,
        failureDetails: testResult.failures,
      });
    }

    res.status(200).json({
      message: blocked ? 'PR blocked: tests failed' : 'PR approved: tests passed',
      blocked,
      testsPassed: testResult.passed,
      failureCount,
    });
  } catch (error) {
    logger.error(
      `Error processing webhook: ${error instanceof Error ? error.message : String(error)}`
    );
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Manual override endpoint
// Usage: POST /api/override
// Body: { owner, repo, prNumber, token, overriddenBy }
app.post('/api/override', async (req: Request, res: Response) => {
  const { owner, repo, prNumber, token, overriddenBy } = req.body;

  if (!owner || !repo || !prNumber || !token || !overriddenBy) {
    res.status(400).json({ error: 'Missing required fields: owner, repo, prNumber, token, overriddenBy' });
    return;
  }

  const overrideReq: OverrideRequest = {
    owner,
    repo,
    prNumber,
    token,
    overriddenBy,
  };

  try {
    const result = await applyOverride(overrideReq);

    if (!result.success) {
      res.status(403).json(result);
      return;
    }

    // Record override in database
    recordOverride({
      owner,
      repo,
      pr_number: prNumber,
      overridden_by: overriddenBy,
      reason: req.body.reason || undefined,
    });

    // Update commit status to success
    const config = getRepoConfig(owner, repo);
    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

    // Fetch the PR to get the head SHA
    const pr = await octokit.pulls.get({ owner, repo, pull_number: prNumber });
    const headSha = pr.data.head.sha;

    await setCommitStatusAfterOverride(owner, repo, headSha);

    // Notify Slack of override
    await notifyOverriddenPR({
      owner,
      repo,
      prNumber,
      prTitle: pr.data.title,
      overriddenBy,
    });

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    logger.error(
      `Error processing override: ${error instanceof Error ? error.message : String(error)}`
    );
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Audit trail endpoint (read-only)
// Usage: GET /api/audit/:owner/:repo?pr=<prNumber>&limit=50
app.get('/api/audit/:owner/:repo', (req: Request, res: Response) => {
  const { owner, repo } = req.params;
  const prNumber = req.query.pr as string | undefined;
  const limit = parseInt(req.query.limit as string) || 50;

  try {
    const { getDecisionsForPR, getRecentDecisions } = require('./db/decisions');

    let decisions;
    if (prNumber) {
      decisions = getDecisionsForPR(owner, repo, parseInt(prNumber));
    } else {
      decisions = getRecentDecisions(owner, repo, limit);
    }

    res.status(200).json({ decisions });
  } catch (error) {
    logger.error(`Error retrieving audit trail: ${error}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'healthy' });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  closeDatabase();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  closeDatabase();
  process.exit(0);
});

// Start server
app.listen(port, () => {
  logger.info(`CI/CD Blocker bot listening on port ${port}`);
});