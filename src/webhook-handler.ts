/**
 * DEPRECATED: This module is a compatibility shim.
 * Use src/webhooks/github.ts instead.
 * 
 * This file remains to prevent build breakage from any legacy imports.
 * All webhook handling logic has been consolidated into src/webhooks/github.ts.
 */

export { handleGitHubWebhook } from './webhooks/github.js';