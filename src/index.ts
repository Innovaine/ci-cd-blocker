import express, { Request, Response } from 'express';
import { handleGitHubWebhook } from './webhooks/github';
import { getDecisionForPR, getRecentDecisions } from './db/decisions';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Health check
app.get('/health', (req: Request, res: Response): void => {
  res.status(200).json({ status: 'ok' });
});

// GitHub webhook receiver
app.post('/webhook', async (req: Request, res: Response): Promise<void> => {
  await handleGitHubWebhook(req, res);
});

// Audit: all decisions for a repo
app.get('/api/audit/:owner/:repo', (req: Request, res: Response): void => {
  const { owner, repo } = req.params;
  const decisions = getRecentDecisions(owner, repo);
  res.status(200).json({
    owner,
    repo,
    decisions,
  });
});

// Audit: decision for a specific PR
app.get('/api/audit/:owner/:repo/:prNumber', (req: Request, res: Response): void => {
  const { owner, repo, prNumber } = req.params;
  const prNum = parseInt(prNumber, 10);

  if (isNaN(prNum)) {
    res.status(400).json({ error: 'Invalid PR number' });
    return;
  }

  const decision = getDecisionForPR(owner, repo, prNum);

  if (!decision) {
    res.status(404).json({ error: 'Decision not found' });
    return;
  }

  res.status(200).json(decision);
});

// Override: manually approve a PR
app.post('/api/override/:owner/:repo/:prNumber', (req: Request, res: Response): void => {
  const { owner, repo, prNumber } = req.params;
  const { reason } = req.body;
  const prNum = parseInt(prNumber, 10);

  if (isNaN(prNum)) {
    res.status(400).json({ error: 'Invalid PR number' });
    return;
  }

  if (!reason) {
    res.status(400).json({ error: 'Override reason required' });
    return;
  }

  console.log(`[Override] PR #${prNum} in ${owner}/${repo} overridden: ${reason}`);

  // Update decision: mark as overridden
  const decisionId = `${owner}/${repo}#${prNum}`;
  const decision = getDecisionForPR(owner, repo, prNum);

  if (!decision) {
    res.status(404).json({ error: 'Decision not found' });
    return;
  }

  decision.overridden = true;
  decision.overrideReason = reason;

  res.status(200).json({
    message: 'Override recorded',
    decisionId,
    decision,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`[Server] CI/CD Blocker listening on port ${PORT}`);
});