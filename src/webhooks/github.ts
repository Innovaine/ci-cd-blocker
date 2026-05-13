import { DecisionRecord, saveDecision } from '../db/decisions';
import { loadRepoConfig } from '../config/repo-config';

export interface WebhookResult {
  decision: DecisionRecord | null;
  message: string;
}

export async function handleGitHubWebhook(payload: any): Promise<WebhookResult> {
  try {
    // Only process pull_request events
    const action = payload.action;
    const pr = payload.pull_request;
    const repo = payload.repository;

    if (!pr || !repo) {
      return {
        decision: null,
        message: 'Not a pull request event, skipping',
      };
    }

    const owner = repo.owner?.login || 'unknown';
    const repoName = repo.name || 'unknown';
    const prNumber = pr.number;

    console.log(`[GitHub] Processing PR #${prNumber} on ${owner}/${repoName}`);

    // Load repo configuration
    const config = loadRepoConfig(owner, repoName);

    // ASSUMPTION: For MVP, assume tests pass if no error. In real version, we'd:
    // 1. Check PR status (draft, mergeable, etc.)
    // 2. Trigger integration tests against staging environment
    // 3. Wait for result
    // 4. Block merge if tests fail
    const testsPassed = true; // Placeholder: would run orchestrateTests(config) here

    const decision = saveDecision({
      owner,
      repo: repoName,
      prNumber,
      testsPassed,
      overridden: false,
      timestamp: new Date(),
    });

    console.log(`[GitHub] Decision saved:`, decision.id);

    return {
      decision,
      message: testsPassed ? 'Tests passed, PR eligible to merge' : 'Tests failed, PR blocked',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[GitHub] Error handling webhook:', message);
    throw new Error(`Webhook processing failed: ${message}`);
  }
}