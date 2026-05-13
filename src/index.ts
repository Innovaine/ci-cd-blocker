import express, { Request, Response } from 'express';
import { handleGitHubWebhook } from './webhooks/github';
import { getRecentDecisions, recordDecision } from './db/decisions';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// ASSUMPTION: In-memory state is acceptable for MVP. After first paying customer, move to persistent DB.

/**
 * Health endpoint — no dependency checks, just confirms the listener is up.
 */
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

/**
 * GitHub webhook receiver.
 * Listens for pull_request events and triggers orchestration.
 */
app.post('/webhook', async (req: Request, res: Response) => {
  try {
    // ASSUMPTION: All GitHub events arrive with X-GitHub-Event header.
    const eventType = req.get('X-GitHub-Event');

    if (eventType !== 'pull_request') {
      return res.status(202).json({ message: 'Event type not handled', type: eventType });
    }

    // Delegate to GitHub handler
    // Handler will orchestrate tests, record decision, notify Slack
    const result = await handleGitHubWebhook(req.body);

    return res.status(200).json(result);
  } catch (err) {
    console.error('[webhook POST error]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Audit endpoint — fetch recent decisions for a repo.
 * GET /api/audit/:owner/:repo
 */
app.get('/api/audit/:owner/:repo', (req: Request, res: Response) => {
  try {
    const { owner, repo } = req.params;
    const decisions = getRecentDecisions(owner, repo, 10);
    return res.status(200).json({ owner, repo, decisions });
  } catch (err) {
    console.error('[audit GET error]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Manual override endpoint (MVP: stub).
 * POST /api/override/:owner/:repo/:prNumber
 * ASSUMPTION: No authentication yet. After first customer, add GitHub app credentials + signature verification.
 */
app.post('/api/override/:owner/:repo/:prNumber', (req: Request, res: Response) => {
  try {
    const { owner, repo, prNumber } = req.params;
    const { reason } = req.body;

    // ASSUMPTION: For now, just log the override. Don't actually update GitHub status yet.
    console.log(`[override] ${owner}/${repo}#${prNumber}: ${reason || '(no reason)'}`);

    return res.status(200).json({ message: 'Override recorded (stub)', owner, repo, prNumber });
  } catch (err) {
    console.error('[override POST error]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`[start] Listening on port ${PORT}`);
});