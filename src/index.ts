import express, { Request, Response } from 'express';
import { handleGitHubWebhook } from './webhooks/github.js';
import { loadRepoConfig } from './config/repo-config.js';
import { notifySlack } from './slack/notifier.js';
import {
  saveDecision,
  getDecisionsForPR,
  getRecentDecisions,
  DecisionRecord,
} from './db/decisions.js';
import type { TestContext, TestResult } from './test/orchestrator.js';
import { orchestrateTests } from './test/orchestrator.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ASSUMPTION: GitHub webhook events arrive at /webhook with X-GitHub-Event header.
// ASSUMPTION: The webhook is verified by GitHub's secret (not implemented yet; assumes external verification).
app.post('/webhook', async (req: Request, res: Response) => {
  const event = req.headers['x-github-event'] as string;

  if (event === 'pull_request') {
    try {
      const payload = req.body;
      const result = await handleGitHubWebhook(payload);

      if (result.decision && result.decision.status === 'blocked') {
        const slackMessage = `PR #${result.decision.prNumber} blocked: ${result.decision.reason}`;
        await notifySlack(slackMessage);
      }

      res.json(result);
    } catch (error) {
      console.error('Webhook handler error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  } else {
    // Non-PR events are ignored for now.
    res.json({ event, ignored: true });
  }
});

// ASSUMPTION: Health check endpoint for load balancers / monitoring.
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ASSUMPTION: Audit endpoint to retrieve decision history for a specific repo.
app.get('/api/audit/:owner/:repo', (req: Request, res: Response) => {
  const { owner, repo } = req.params;
  const decisions = getRecentDecisions(100);
  const filtered = decisions.filter(
    (d) => d.owner === owner && d.repo === repo
  );
  res.json({ owner, repo, decisions: filtered });
});

// ASSUMPTION: Manual override endpoint (requires auth token in header).
// For MVP, no auth is implemented. In production, this would require a valid token.
app.post('/api/override/:owner/:repo/:prNumber', (req: Request, res: Response) => {
  const { owner, repo, prNumber } = req.params;
  const { reason } = req.body;

  const override: DecisionRecord = {
    id: `override-${Date.now()}`,
    timestamp: new Date().toISOString(),
    owner,
    repo,
    prNumber: parseInt(prNumber, 10),
    status: 'approved',
    reason: reason || 'Manual override',
    testsPassed: true,
    integrationTestUrl: null,
  };

  saveDecision(override);
  res.json(override);
});

app.listen(PORT, () => {
  console.log(`CI/CD Blocker listening on port ${PORT}`);
});