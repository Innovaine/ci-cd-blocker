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