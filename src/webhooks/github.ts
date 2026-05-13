export interface WebhookPayload {
  action: string;
  pull_request?: {
    number: number;
    head?: {
      sha: string;
    };
    base?: {
      repo?: {
        name: string;
        owner?: {
          login: string;
        };
      };
    };
  };
}

export interface WebhookResult {
  success: boolean;
  decision?: {
    status: 'approved' | 'blocked' | 'approved_override' | 'skipped';
    reason: string;
  };
  error?: string;
}

export function parseGitHubWebhook(payload: any): WebhookPayload {
  return payload as WebhookPayload;
}

export function validateWebhookSignature(signature: string, secret: string, body: string): boolean {
  // ASSUMPTION: In MVP, no signature validation. Accept all webhooks.
  console.log(`[github] Webhook received, signature validation skipped`);
  return true;
}