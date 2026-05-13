import express from 'express';
import { Router } from 'express';
import { handleGitHubPullRequestEvent } from './webhooks/github';
import { getDecisionsForPR, getRecentDecisions, recordDecision } from './db/decisions';

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// GitHub webhook endpoint — single, canonical webhook handler
app.post('/webhook/github', async (req, res) => {
  try {
    const result = await handleGitHubPullRequestEvent(req.body);
    res.status(200).json({ success: true, result });
  } catch (err) {
    console.error('Webhook handler error:', err);
    res.status(400).json({ success: false, error: String(err) });
  }
});

// Audit: get decisions for a specific PR
app.get('/api/audit/:owner/:repo/:prNumber', async (req, res) => {
  try {
    const { owner, repo, prNumber } = req.params;
    const decisions = await getDecisionsForPR(owner, repo, parseInt(prNumber, 10));
    res.status(200).json({ decisions });
  } catch (err) {
    console.error('Audit fetch error:', err);
    res.status(400).json({ error: String(err) });
  }
});

// Audit: get recent decisions for a repo
app.get('/api/audit/:owner/:repo', async (req, res) => {
  try {
    const { owner, repo } = req.params;
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const decisions = await getRecentDecisions(owner, repo, limit);
    res.status(200).json({ decisions });
  } catch (err) {
    console.error('Recent decisions fetch error:', err);
    res.status(400).json({ error: String(err) });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Start server
app.listen(port, () => {
  console.log(`CI/CD Blocker running on port ${port}`);
});

export default app;