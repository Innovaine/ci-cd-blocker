import { Request, Response } from 'express';
import { RepoConfig, loadRepoConfig } from '../config/repo-config';
import { orchestrateTests } from '../test/orchestrator';
import { recordDecision } from '../db/decisions';
import { notifySlack } from '../slack/notifier';

export interface WebhookPayload {
  action: string;
  pull_request?: {
    number: number;
    head?: {
      repo?: {
        owner?: { login: string };
        name?: string;
      };
    };
  };
  repository?: {
    owner?: { login: string };
    name?: string;
  };
}

export interface WebhookResult {
  received: boolean;
  decisionId?: string;
  error?: string;
}

export async function handleGitHubWebhook(req: Request, res: Response): Promise<void> {
  const payload: WebhookPayload = req.body;

  // Extract owner and repo
  const owner =
    payload.pull_request?.head?.repo?.owner?.login || payload.repository?.owner?.login;
  const repo = payload.pull_request?.head?.repo?.name || payload.repository?.name;
  const prNumber = payload.pull_request?.number;

  if (!owner || !repo || !prNumber) {
    const result: WebhookResult = {
      received: false,
      error: 'Missing owner, repo, or PR number in payload',
    };
    res.status(400).json(result);
    return;
  }

  console.log(
    `[GitHub] Webhook received for ${owner}/${repo} PR #${prNumber}, action=${payload.action}`
  );

  // Load repo config
  const config = loadRepoConfig(owner, repo);

  // Run orchestrator (test execution)
  let testResult;
  try {
    testResult = await orchestrateTests(config, prNumber);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Orchestrator] Failed for PR #${prNumber}:`, message);
    const result: WebhookResult = {
      received: false,
      error: `Test orchestration failed: ${message}`,
    };
    res.status(500).json(result);
    return;
  }

  // Build decision record
  const decisionId = `${owner}/${repo}#${prNumber}`;
  const decision = {
    owner,
    repo,
    prNumber,
    testsPassed: testResult.testsPassed,
    overridden: false,
    timestamp: Date.now(),
  };

  // Record decision
  recordDecision(decisionId, decision);

  // Notify Slack (fire-and-forget; do not block webhook response)
  notifySlack(decision).catch((err) => {
    console.error(`[Slack] Error notifying (non-blocking):`, err);
  });

  // Return success
  const result: WebhookResult = {
    received: true,
    decisionId,
  };
  res.status(200).json(result);
}