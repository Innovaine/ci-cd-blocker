import express from 'express';
import { handleGitHubWebhook } from './webhooks/github';
import { loadRepoConfig } from './config/repo-config';
import { initializeDatabase } from './db/decisions';
import { notifySlack } from './slack/notifier';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Initialize database on startup
initializeDatabase();

// GitHub webhook: receive push/pull_request events
app.post('/webhook/github', async (req, res) => {
  try {
    const result = await handleGitHubWebhook(req.body);
    res.status(200).json(result);
  } catch (error) {
    console.error('Webhook handler error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Audit endpoint: retrieve decision history (read-only)
// ASSUMPTION: future enhancement — not required for MVP
app.get('/api/audit/:owner/:repo', (req, res) => {
  res.status(501).json({ message: 'Audit endpoint coming in week 3' });
});

app.listen(PORT, () => {
  console.log(`CI/CD Blocker listening on port ${PORT}`);
});

export default app;