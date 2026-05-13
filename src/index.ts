import express, { Request, Response } from 'express';
import { handleGitHubWebhook } from './webhooks/github';
import { getDecisionsForRepo, getDecisionByPR, recordDecision, overrideDecision } from './db/decisions';
import { notifySlack } from './slack/notifier';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

// GitHub webhook endpoint
app.post('/webhook', async (req: Request, res: Response) => {
  try {
    const payload = req.body;

    // Validate basic structure
    if (!payload.action || !payload.pull_request || !payload.repository) {
      console.warn('[Webhook] Ignoring payload — missing action, pull_request, or repository');
      return res.status(400).json({ error: 'Invalid payload structure' });
    }

    const result = await handleGitHubWebhook(payload);
    
    // Notify Slack
    if (result.decision) {
      try {
        await notifySlack(result.decision);
      } catch (slackError) {
        console.error('[Webhook] Slack notification failed, continuing:', slackError);
        // Non-blocking; don't fail the webhook response
      }
    }

    res.status(200).json({ success: true, decision: result.decision });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Webhook] Error:', message);
    res.status(500).json({ error: message });
  }
});

// Audit endpoint: get all decisions for a repo
app.get('/api/audit/:owner/:repo', (req: Request, res: Response) => {
  try {
    const { owner, repo } = req.params;
    const decisions = getDecisionsForRepo(owner, repo);
    res.status(200).json({ owner, repo, decisions });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Audit] Error:', message);
    res.status(500).json({ error: message });
  }
});

// Audit endpoint: get decision for a specific PR
app.get('/api/audit/:owner/:repo/:prNumber', (req: Request, res: Response) => {
  try {
    const { owner, repo, prNumber } = req.params;
    const pr = parseInt(prNumber, 10);
    if (isNaN(pr)) {
      return res.status(400).json({ error: 'Invalid PR number' });
    }
    const decision = getDecisionByPR(owner, repo, pr);
    if (!decision) {
      return res.status(404).json({ error: 'Decision not found' });
    }
    res.status(200).json(decision);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Audit] Error:', message);
    res.status(500).json({ error: message });
  }
});

// Override endpoint: manually override a decision
app.post('/api/override/:owner/:repo/:prNumber', (req: Request, res: Response) => {
  try {
    const { owner, repo, prNumber } = req.params;
    const { reason } = req.body;

    const pr = parseInt(prNumber, 10);
    if (isNaN(pr)) {
      return res.status(400).json({ error: 'Invalid PR number' });
    }

    if (!reason || typeof reason !== 'string') {
      return res.status(400).json({ error: 'Override reason is required and must be a string' });
    }

    const decision = overrideDecision(owner, repo, pr, reason);
    res.status(200).json({ success: true, decision });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Override] Error:', message);
    res.status(500).json({ error: message });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`[Server] Listening on port ${PORT}`);
});