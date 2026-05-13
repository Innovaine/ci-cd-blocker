import express, { Request, Response } from 'express';
import { handleGitHubWebhook } from './webhooks/github';
import { getDecisions, recordDecision } from './db/decisions';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// GitHub webhook endpoint
app.post('/webhook', async (req: Request, res: Response) => {
  try {
    const decision = await handleGitHubWebhook(req.body);
    res.status(200).json({ success: true, decisionId: decision.id });
  } catch (error) {
    console.error('Webhook handler error:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

// Audit endpoint: all decisions for a repo
app.get('/api/audit/:owner/:repo', (req: Request, res: Response) => {
  const { owner, repo } = req.params;
  const decisions = getDecisions(owner, repo);
  res.status(200).json({
    owner,
    repo,
    decisions,
    count: decisions.length,
  });
});

// Audit endpoint: specific PR decision
app.get('/api/audit/:owner/:repo/:prNumber', (req: Request, res: Response) => {
  const { owner, repo, prNumber } = req.params;
  const decisions = getDecisions(owner, repo);
  const decision = decisions.find((d) => d.prNumber === parseInt(prNumber, 10));
  if (!decision) {
    res.status(404).json({ error: 'Decision not found' });
    return;
  }
  res.status(200).json(decision);
});

// Override endpoint: manually approve a PR (bypass test failure)
app.post('/api/override/:owner/:repo/:prNumber', (req: Request, res: Response) => {
  const { owner, repo, prNumber } = req.params;
  const { reason } = req.body;

  // ASSUMPTION: In MVP, override is unrestricted. No auth, no audit trail beyond reason.
  const decisions = getDecisions(owner, repo);
  const decision = decisions.find((d) => d.prNumber === parseInt(prNumber, 10));

  if (!decision) {
    res.status(404).json({ error: 'Decision not found' });
    return;
  }

  decision.status = 'approved_override';
  decision.overrideReason = reason || 'Manual override (no reason provided)';
  decision.overriddenAt = new Date().toISOString();

  res.status(200).json({ success: true, decision });
});

// Start server
app.listen(PORT, () => {
  console.log(`CI/CD Blocker listening on port ${PORT}`);
});