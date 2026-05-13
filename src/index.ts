import express, { Request, Response } from 'express';
import { handleGitHubWebhook } from './webhooks/github';
import { notifySlack } from './slack/notifier';

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

// GitHub webhook endpoint
app.post('/webhook', async (req: Request, res: Response) => {
  try {
    console.log('[Webhook] Received event:', req.body?.action || 'unknown action');
    
    const result = await handleGitHubWebhook(req.body);

    // Attempt Slack notification if webhook URL is configured
    if (process.env.SLACK_WEBHOOK_URL && result.decision) {
      await notifySlack(result.decision).catch((err) => {
        console.warn('[Slack] Notification failed (non-blocking):', err.message);
      });
    }

    res.status(200).json({
      success: true,
      message: 'Webhook processed',
      decision: result.decision,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Webhook] Error processing webhook:', message);
    res.status(400).json({ success: false, error: message });
  }
});

// Audit endpoint: get recent decisions
app.get('/api/audit/:owner/:repo', (req: Request, res: Response) => {
  try {
    const { owner, repo } = req.params;
    const { getRecentDecisions } = require('./db/decisions');

    const decisions = getRecentDecisions(owner, repo, 10);
    res.status(200).json({
      success: true,
      owner,
      repo,
      decisions,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Audit] Error fetching decisions:', message);
    res.status(500).json({ success: false, error: message });
  }
});

// Audit endpoint: get specific PR decisions
app.get('/api/audit/:owner/:repo/:prNumber', (req: Request, res: Response) => {
  try {
    const { owner, repo, prNumber } = req.params;
    const { getDecisionsForPR } = require('./db/decisions');

    const decisions = getDecisionsForPR(owner, repo, parseInt(prNumber, 10));
    res.status(200).json({
      success: true,
      owner,
      repo,
      prNumber: parseInt(prNumber, 10),
      decisions,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Audit] Error fetching PR decisions:', message);
    res.status(500).json({ success: false, error: message });
  }
});

// Manual override endpoint
app.post('/api/override/:owner/:repo/:prNumber', (req: Request, res: Response) => {
  try {
    const { owner, repo, prNumber } = req.params;
    const { reason } = req.body;

    // ASSUMPTION: No auth on this endpoint for MVP. In production, verify GitHub token or similar.
    const { saveDecision } = require('./db/decisions');

    saveDecision({
      owner,
      repo,
      prNumber: parseInt(prNumber, 10),
      testsPassed: true,
      overridden: true,
      overrideReason: reason || 'Manual override',
      timestamp: new Date(),
    });

    res.status(200).json({
      success: true,
      message: 'Override recorded',
      owner,
      repo,
      prNumber: parseInt(prNumber, 10),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Override] Error recording override:', message);
    res.status(500).json({ success: false, error: message });
  }
});

// Start server
app.listen(port, () => {
  console.log(`[App] CI/CD Blocker listening on port ${port}`);
});