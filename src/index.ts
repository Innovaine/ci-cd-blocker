import express, { Express, Request, Response } from 'express';
import { handleWebhook } from './webhook-handler';
import { getDecisions } from './db/decisions';

const app: Express = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// GitHub webhook endpoint
app.post('/webhook', async (req: Request, res: Response) => {
  try {
    const payload = req.body;
    console.log(`[webhook] Received event:`, payload?.action, `PR:`, payload?.pull_request?.number);

    const result = await handleWebhook(payload);

    res.status(result.success ? 200 : 400).json(result);
  } catch (e) {
    console.error(`[webhook] Handler error:`, e);
    res.status(500).json({ success: false, error: String(e) });
  }
});

// Audit endpoint: list decisions for a repo
app.get('/api/audit/:owner/:repo', (req: Request, res: Response) => {
  try {
    const { owner, repo } = req.params;
    const decisions = getDecisions(owner, repo);
    res.json({ owner, repo, decisions, count: decisions.length });
  } catch (e) {
    console.error(`[audit] Error fetching decisions for ${req.params.owner}/${req.params.repo}:`, e);
    res.status(500).json({ error: String(e) });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`CI/CD Blocker listening on port ${PORT}`);
});