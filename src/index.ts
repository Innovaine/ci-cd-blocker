import express, { Request, Response } from 'express';
import { handleGitHubWebhook } from './webhooks/github.js';
import { notifySlack } from './slack/notifier.js';
import { getRecentDecisions, getDecisionsForPR } from './db/decisions.js';
import type { DecisionRecord } from './db/decisions.js';

const PORT = process.env.PORT || 3000;
const app = express();

app.use(express.json());

// GitHub webhook endpoint.
// ASSUMPTION: GitHub webhook events arrive at /webhook with X-GitHub-Event header.
// ASSUMPTION: The webhook secret is verified externally (not implemented yet).
app.post('/webhook', async (req: Request, res: Response) => {
  const event = req.headers['x-github-event'] as string;

  if (event === 'pull_request') {
    try {
      const payload = req.body;
      const result = await handleGitHubWebhook(payload);

      if (result.success && result.decision) {
        const decision = result.decision;

        // Notify Slack if the PR was blocked.
        if (decision.status === 'blocked') {
          const slackMessage = `🚫 PR #${decision.prNumber} in ${decision.owner}/${decision.repo} blocked: ${decision.reason}`;
          await notifySlack(slackMessage).catch((err) => {
            console.warn('Slack notification failed:', err);
          });
        } else {
          const slackMessage = `✅ PR #${decision.prNumber} in ${decision.owner}/${decision.repo} approved: ${decision.reason}`;
          await notifySlack(slackMessage).catch((err) => {
            console.warn('Slack notification failed:', err);
          });
        }
      }

      res.json(result);
    } catch (error) {
      console.error('Webhook handler error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  } else {
    // Non-PR events are ignored.
    res.json({ event, ignored: true });
  }
});

// Health check endpoint.
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Audit endpoint: retrieve decisions for a specific repo.
app.get('/api/audit/:owner/:repo', async (req: Request, res: Response) => {
  try {
    const { owner, repo } = req.params;
    const decisions = await getRecentDecisions(100);
    const filtered = decisions.filter(
      (d) => d.owner === owner && d.repo === repo
    );
    res.json({ owner, repo, decisions: filtered });
  } catch (error) {
    console.error('Audit endpoint error:', error);
    res.status(500).json({ error: 'Failed to retrieve audit log' });
  }
});

// Audit endpoint: retrieve decisions for a specific PR.
app.get('/api/audit/:owner/:repo/:prNumber', async (req: Request, res: Response) => {
  try {
    const { owner, repo, prNumber } = req.params;
    const decisions = await getDecisionsForPR(owner, repo, parseInt(prNumber, 10));
    res.json({ owner, repo, prNumber, decisions });
  } catch (error) {
    console.error('PR audit endpoint error:', error);
    res.status(500).json({ error: 'Failed to retrieve PR decisions' });
  }
});

// Manual override endpoint.
// ASSUMPTION: No auth for MVP. In production, this requires a valid token.
app.post('/api/override/:owner/:repo/:prNumber', async (req: Request, res: Response) => {
  try {
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

    const { saveDecision } = await import('./db/decisions.js');
    await saveDecision(override);

    // Notify Slack of the override.
    const slackMessage = `🔓 Override: PR #${override.prNumber} in ${owner}/${repo} manually approved. Reason: ${override.reason}`;
    await notifySlack(slackMessage).catch((err) => {
      console.warn('Slack notification failed:', err);
    });

    res.json(override);
  } catch (error) {
    console.error('Override endpoint error:', error);
    res.status(500).json({ error: 'Failed to apply override' });
  }
});

app.listen(PORT, () => {
  console.log(`CI/CD Blocker listening on port ${PORT}`);
});