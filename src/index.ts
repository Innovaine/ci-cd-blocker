/**
 * Main entry point for CI/CD Deployment Blocker.
 * Sets up Express server with GitHub webhook route.
 */

import express, { Request, Response } from 'express';
import { handleGitHubWebhook } from './webhooks/github.js';
import { getRecentDecisions } from './db/decisions.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// GitHub webhook endpoint
app.post('/webhook', async (req: Request, res: Response) => {
  try {
    const result = await handleGitHubWebhook(req.body);
    res.json(result);
  } catch (err) {
    console.error('[Webhook] Error handling GitHub event:', err);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

// Audit endpoint: recent decisions for a repo
app.get('/api/audit/:owner/:repo', async (req: Request, res: Response) => {
  try {
    const { owner, repo } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const decisions = await getRecentDecisions(owner, repo, limit);
    res.json({ owner, repo, decisions });
  } catch (err) {
    console.error('[Audit] Error fetching decisions:', err);
    res.status(500).json({ error: 'Failed to fetch decisions' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`[App] CI/CD Blocker listening on port ${PORT}`);
});