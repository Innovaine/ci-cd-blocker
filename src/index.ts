import express, { Request, Response } from 'express';
import { handleGitHubWebhook, GitHubWebhookPayload } from './webhooks/github';
import { loadRepoConfig } from './config/repo-config';
import { recordDecision, getDecisionForPR, getRecentDecisions } from './db/decisions';
import { notifySlack } from './slack/notifier';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// In-memory store of decisions (reset on restart).
interface WebhookResponse {
  success: boolean;
  decisionId: string;
  testsPassed: boolean;
  message: string;
}

// Health check endpoint
app.get('/health', (req: Request, res: Response): void => {
  res.status(200).json({ status: 'healthy' });
});

// GitHub webhook endpoint
app.post('/webhook', async (req: Request, res: Response): Promise<void> => {
  const payload = req.body as GitHubWebhookPayload;

  if (!payload.repository || !payload.pull_request) {
    res.status(400).json({ error: 'Invalid GitHub webhook payload' });
    return;
  }

  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;
  const prNumber = payload.pull_request.number;

  try {
    const config = loadRepoConfig(owner, repo);
    const result = await handleGitHubWebhook(payload, config);

    const decisionId = `${owner}/${repo}#${prNumber}`;
    const decision = {
      owner,
      repo,
      prNumber,
      testsPassed: result.testsPassed,
      overridden: false,
      overrideReason: undefined,
      timestamp: Date.now(),
    };

    recordDecision(decisionId, decision);

    // Notify Slack (best-effort, non-blocking).
    try {
      await notifySlack(decision);
    } catch (slackError) {
      console.error('[Webhook] Slack notification failed, but continuing:', slackError);
    }

    const response: WebhookResponse = {
      success: true,
      decisionId,
      testsPassed: result.testsPassed,
      message: result.testsPassed ? 'Tests passed, merge allowed' : 'Tests failed, merge blocked',
    };
    res.status(200).json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Webhook] Error processing GitHub webhook:', message);
    res.status(500).json({ error: 'Failed to process webhook', details: message });
  }
});

// Audit: list all decisions for a repo
app.get('/api/audit/:owner/:repo', (req: Request, res: Response): void => {
  const { owner, repo } = req.params;
  const decisions = getRecentDecisions(owner, repo);
  res.status(200).json(decisions);
});

// Audit: get decision for a specific PR
app.get('/api/audit/:owner/:repo/:prNumber', (req: Request, res: Response): void => {
  const { owner, repo, prNumber } = req.params;
  const decision = getDecisionForPR(owner, repo, parseInt(prNumber, 10));

  if (!decision) {
    res.status(404).json({ error: 'No decision found for this PR' });
    return;
  }

  res.status(200).json(decision);
});

// Override endpoint: allow manual approval of a blocked PR
app.post('/api/override/:owner/:repo/:prNumber', (req: Request, res: Response): void => {
  const { owner, repo, prNumber } = req.params;
  const { reason } = req.body as { reason: string };

  if (!reason) {
    res.status(400).json({ error: 'Missing override reason' });
    return;
  }

  const numPR = parseInt(prNumber, 10);
  const decisionId = `${owner}/${repo}#${numPR}`;
  const existingDecision = getDecisionForPR(owner, repo, numPR);

  if (!existingDecision) {
    res.status(404).json({ error: 'No decision found for this PR' });
    return;
  }

  const overriddenDecision = {
    ...existingDecision,
    overridden: true,
    overrideReason: reason,
  };

  recordDecision(decisionId, overriddenDecision);

  res.status(200).json({
    success: true,
    decisionId,
    message: 'PR approved via override',
    decision: overriddenDecision,
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`[App] CI/CD Blocker listening on port ${PORT}`);
});