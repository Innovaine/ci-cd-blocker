/**
 * DEPRECATED: This module is a compatibility shim.
 * All webhook handling logic has been consolidated into src/webhooks/github.ts.
 * 
 * This file remains to prevent runtime breakage from legacy imports.
 */

export { handleGitHubWebhook, type WebhookPayload, type WebhookResult } from './webhooks/github.js';