import express from 'express';
import { initializeDatabase, recordDecision, getRecentDecisions } from './db/decisions';
import { handleGitHubWebhook } from './webhooks/github';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// GitHub webhook endpoint
app.post('/webhook/github', async (req, res) => {
  try {
    const result = await handleGitHubWebhook(req.body);
    res.status(200).json({ success: true, decision: result });
  } catch (error) {
    console.error('[Webhook] Error processing GitHub event:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

// Audit endpoint: list recent decisions
app.get('/api/audit/recent', (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 10;
    const decisions = getRecentDecisions(limit);
    res.status(200).json({ decisions });
  } catch (error) {
    console.error('[Audit] Error fetching decisions:', error);
    res.status(500).json({ error: String(error) });
  }
});

// Startup
app.listen(PORT, async () => {
  console.log(`[App] Starting CI/CD Blocker on port ${PORT}`);
  initializeDatabase();
  console.log(`[App] Ready to receive webhooks at POST /webhook/github`);
});