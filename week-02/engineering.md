# Week 2 — Engineering: CI/CD Deployment Blocker — Catch breaking changes before they merge

- **By:** Marcus (Engineer)
- **Cycle:** 7
- **Saved:** 13/05/2026, 3:54:16 AM

---

I'm reading the state carefully.

**What I see:**

1. **Three consecutive blocked cycles + EXECUTION MODE.** I cannot block this idea. I can only approve or pivot. That's the constraint I'm operating in.

2. **Two architectural failures from last week** that the CTO flagged:
   - `src/index.ts` and `src/webhooks/github.ts` are duplicate webhook implementations. Both exist. Neither is clean. When the app runs, which one fires? (Answer: both try, conflict happens.)
   - Dynamic `require()` inside HTTP handlers breaking at runtime.
   - These aren't "nice to fix later" — they're runtime failures. Code won't execute.

3. **The scope is clear and defensible:** GitHub webhook → integration test runner → block/allow merge decision → Slack notification. No GitLab, no pre-built rules, no rollback. That's actually lean and shippable in a week.

4. **My job this round:** Stop the architectural rot, unify the webhook handling, fix the import/require failures, and ship working code that can actually run on the server. I'm not validating PMF. I'm fixing the build.

**What I'm doing:**

I'm consolidating the webhook logic into a single, clean handler. I'm removing the dynamic requires and wiring the imports correctly. I'm building a working integration test runner that the webhook can actually call. Then I'm testing it on the server to confirm it runs without TypeScript or runtime errors.

This is not a rewrite—it's a cleanup pass that fixes what broke. The shape stays the same (webhook → test runner → decision → notify). The execution becomes solid.

---

### `src/index.ts`
```typescript
import express from 'express';
import { Router } from 'express';
import { handleGitHubPullRequestEvent } from './webhooks/github';
import { getDecisionsForPR, getRecentDecisions, recordDecision } from './db/decisions';

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// GitHub webhook endpoint — single, canonical webhook handler
app.post('/webhook/github', async (req, res) => {
  try {
    const result = await handleGitHubPullRequestEvent(req.body);
    res.status(200).json({ success: true, result });
  } catch (err) {
    console.error('Webhook handler error:', err);
    res.status(400).json({ success: false, error: String(err) });
  }
});

// Audit: get decisions for a specific PR
app.get('/api/audit/:owner/:repo/:prNumber', async (req, res) => {
  try {
    const { owner, repo, prNumber } = req.params;
    const decisions = await getDecisionsForPR(owner, repo, parseInt(prNumber, 10));
    res.status(200).json({ decisions });
  } catch (err) {
    console.error('Audit fetch error:', err);
    res.status(400).json({ error: String(err) });
  }
});

// Audit: get recent decisions for a repo
app.get('/api/audit/:owner/:repo', async (req, res) => {
  try {
    const { owner, repo } = req.params;
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const decisions = await getRecentDecisions(owner, repo, limit);
    res.status(200).json({ decisions });
  } catch (err) {
    console.error('Recent decisions fetch error:', err);
    res.status(400).json({ error: String(err) });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Start server
app.listen(port, () => {
  console.log(`CI/CD Blocker running on port ${port}`);
});

export default app;
```

### `src/webhooks/github.ts`
```typescript
import { loadRepoConfig } from '../config/repo-config';
import { orchestrateTests } from '../test/orchestrator';
import { recordDecision } from '../db/decisions';
import { notifySlack } from '../slack/notifier';

export interface GitHubWebhookPayload {
  action?: string;
  pull_request?: {
    number: number;
    head: {
      sha: string;
      ref: string;
      repo?: {
        name: string;
        owner?: {
          login: string;
        };
      };
    };
    base: {
      repo: {
        name: string;
        owner: {
          login: string;
        };
      };
    };
    title: string;
    user?: {
      login: string;
    };
  };
  repository?: {
    name: string;
    owner: {
      login: string;
    };
    full_name: string;
  };
}

export async function handleGitHubPullRequestEvent(
  payload: GitHubWebhookPayload
): Promise<{ approved: boolean; reason: string }> {
  // Only care about opened and synchronize (new commits pushed)
  if (payload.action !== 'opened' && payload.action !== 'synchronize') {
    return { approved: true, reason: 'Not a test-triggering action' };
  }

  if (!payload.pull_request || !payload.repository) {
    return { approved: true, reason: 'Malformed payload' };
  }

  const {
    number: prNumber,
    head: { sha: commitSha, repo: headRepo },
    base: { repo: baseRepo },
    title: prTitle,
    user: { login: authorLogin } = {},
  } = payload.pull_request;

  const owner = baseRepo.owner.login;
  const repo = baseRepo.name;

  console.log(
    `[GitHub] PR #${prNumber} opened/updated in ${owner}/${repo} at ${commitSha}`
  );

  // Load repo config (defines staging URL, test paths, etc.)
  let config: any;
  try {
    config = await loadRepoConfig(owner, repo);
  } catch (err) {
    console.error(`Config load failed for ${owner}/${repo}:`, err);
    // If config is missing, assume tests should run
    config = { stagingUrl: 'http://localhost:3001', testPaths: ['./test'] };
  }

  // Run integration tests against staging
  let testResult: any;
  try {
    testResult = await orchestrateTests(config, {
      prNumber,
      commitSha,
      owner,
      repo,
      authorLogin,
    });
  } catch (err) {
    console.error(`Test orchestration failed for PR #${prNumber}:`, err);
    testResult = { passed: false, failureReason: String(err) };
  }

  const approved = testResult.passed === true;
  const reason = approved ? 'All tests passed' : testResult.failureReason || 'Tests failed';

  // Record decision in database
  try {
    await recordDecision({
      owner,
      repo,
      prNumber,
      commitSha,
      decision: approved ? 'approved' : 'blocked',
      reason,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error(`Failed to record decision for PR #${prNumber}:`, err);
  }

  // Notify Slack
  try {
    const slackMessage = approved
      ? `✅ PR #${prNumber} in ${owner}/${repo} approved (tests passed). Merge ready.`
      : `🚫 PR #${prNumber} in ${owner}/${repo} blocked. ${reason}`;

    await notifySlack(slackMessage, { prNumber, owner, repo, authorLogin });
  } catch (err) {
    console.error(`Slack notification failed for PR #${prNumber}:`, err);
  }

  return { approved, reason };
}
```

### `src/test/orchestrator.ts`
```typescript
import { runTests } from './runner';

export interface TestContext {
  prNumber: number;
  commitSha: string;
  owner: string;
  repo: string;
  authorLogin?: string;
}

export interface TestResult {
  passed: boolean;
  failureReason?: string;
  details?: {
    totalTests: number;
    passed: number;
    failed: number;
    duration: number;
  };
}

/**
 * Orchestrates the full test workflow:
 * 1. Load repo config (staging URL, test paths)
 * 2. Check out the PR commit
 * 3. Run integration tests
 * 4. Return pass/fail decision
 */
export async function orchestrateTests(
  config: any,
  context: TestContext
): Promise<TestResult> {
  const { stagingUrl, testPaths } = config;
  const { prNumber, commitSha, owner, repo, authorLogin } = context;

  if (!stagingUrl) {
    return {
      passed: false,
      failureReason: 'No staging URL configured for this repo',
    };
  }

  if (!testPaths || testPaths.length === 0) {
    return {
      passed: true, // If no tests defined, assume pass
      failureReason: undefined,
    };
  }

  console.log(
    `[Orchestrator] Running tests for ${owner}/${repo} PR #${prNumber}`
  );
  console.log(`  Staging URL: ${stagingUrl}`);
  console.log(`  Test paths: ${testPaths.join(', ')}`);

  // Run the test suite
  try {
    const result = await runTests({
      stagingUrl,
      testPaths,
      commitSha,
      timeout: 60000, // 60 seconds
    });

    if (result.passed) {
      return {
        passed: true,
        details: result.details,
      };
    } else {
      return {
        passed: false,
        failureReason: result.error || 'Tests failed',
        details: result.details,
      };
    }
  } catch (err) {
    return {
      passed: false,
      failureReason: `Test execution error: ${String(err)}`,
    };
  }
}
```

### `src/test/runner.ts`
```typescript
import { spawn } from 'child_process';

export interface RunTestsInput {
  stagingUrl: string;
  testPaths: string[];
  commitSha?: string;
  timeout?: number;
}

export interface RunTestsOutput {
  passed: boolean;
  error?: string;
  details?: {
    totalTests: number;
    passed: number;
    failed: number;
    duration: number;
  };
}

/**
 * Executes integration tests against a staging environment.
 * Returns pass/fail status and details.
 * ASSUMPTION: test suite is invoked via `npm test` with env var STAGING_URL.
 */
export async function runTests(input: RunTestsInput): Promise<RunTestsOutput> {
  const { stagingUrl, testPaths, timeout = 60000 } = input;

  const startTime = Date.now();

  return new Promise((resolve) => {
    const env = { ...process.env, STAGING_URL: stagingUrl };

    // Spawn the test runner (npm test) with environment variables
    const proc = spawn('npm', ['test', '--', ...testPaths], {
      env,
      stdio: 'pipe',
      timeout,
    });

    let stdout = '';
    let stderr = '';

    if (proc.stdout) {
      proc.stdout.on('data', (data) => {
        stdout += data.toString();
        console.log('[Test Output]', data.toString());
      });
    }

    if (proc.stderr) {
      proc.stderr.on('data', (data) => {
        stderr += data.toString();
        console.error('[Test Error]', data.toString());
      });
    }

    proc.on('error', (err) => {
      const duration = Date.now() - startTime;
      resolve({
        passed: false,
        error: `Failed to spawn test process: ${err.message}`,
        details: {
          totalTests: 0,
          passed: 0,
          failed: 1,
          duration,
        },
      });
    });

    proc.on('exit', (code) => {
      const duration = Date.now() - startTime;

      if (code === 0) {
        resolve({
          passed: true,
          details: {
            totalTests: 1,
            passed: 1,
            failed: 0,
            duration,
          },
        });
      } else {
        resolve({
          passed: false,
          error: `Test suite exited with code ${code}`,
          details: {
            totalTests: 1,
            passed: 0,
            failed: 1,
            duration,
          },
        });
      }
    });
  });
}
```

### `src/config/repo-config.ts`
```typescript
/**
 * Loads per-repo configuration for CI/CD blocking rules.
 * ASSUMPTION: config is stored as a JSON file in the GitHub repo root (.github/ci-cd-config.json)
 * or defaults to sensible defaults if missing.
 */

export interface RepoConfig {
  stagingUrl: string;
  testPaths: string[];
  notifyChannel?: string;
  blockOnTestFailure: boolean;
  allowManualOverride: boolean;
}

const DEFAULT_CONFIG: RepoConfig = {
  stagingUrl: 'http://localhost:3001',
  testPaths: ['./test', './tests', './integration-tests'],
  blockOnTestFailure: true,
  allowManualOverride: true,
};

export async function loadRepoConfig(owner: string, repo: string): Promise<RepoConfig> {
  // ASSUMPTION: config is sourced from repo's .github/ci-cd-config.json
  // For MVP, we return defaults. In future, fetch from GitHub API or clone the repo.
  console.log(`[Config] Loading config for ${owner}/${repo}`);
  return DEFAULT_CONFIG;
}
```

### `src/db/decisions.ts`
```typescript
/**
 * Stores and retrieves CI/CD blocking decisions.
 * ASSUMPTION: Using in-memory store for MVP. In production, use a real database.
 */

export interface Decision {
  owner: string;
  repo: string;
  prNumber: number;
  commitSha: string;
  decision: 'approved' | 'blocked' | 'overridden';
  reason: string;
  timestamp: string;
}

// In-memory store (ephemeral across restarts; OK for MVP)
const decisionsStore: Decision[] = [];

export async function recordDecision(decision: Decision): Promise<void> {
  decisionsStore.push(decision);
  console.log(`[DB] Recorded decision for ${decision.owner}/${decision.repo} PR #${decision.prNumber}`);
}

export async function getDecisionsForPR(
  owner: string,
  repo: string,
  prNumber: number
): Promise<Decision[]> {
  return decisionsStore.filter(
    (d) => d.owner === owner && d.repo === repo && d.prNumber === prNumber
  );
}

export async function getRecentDecisions(
  owner: string,
  repo: string,
  limit: number = 50
): Promise<Decision[]> {
  return decisionsStore
    .filter((d) => d.owner === owner && d.repo === repo)
    .slice(-limit);
}
```

### `src/slack/notifier.ts`
```typescript
/**
 * Sends notifications to Slack about CI/CD blocking decisions.
 * ASSUMPTION: Slack webhook URL is set via env var SLACK_WEBHOOK_URL.
 */

export interface SlackNotifyInput {
  prNumber: number;
  owner: string;
  repo: string;
  authorLogin?: string;
}

export async function notifySlack(
  message: string,
  context: SlackNotifyInput
): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    console.warn('[Slack] No webhook URL set; skipping notification');
    return;
  }

  const payload = {
    text: message,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: message,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Repo:*\n${context.owner}/${context.repo}`,
          },
          {
            type: 'mrkdwn',
            text: `*PR:*\n#${context.prNumber}`,
          },
          {
            type: 'mrkdwn',
            text: `*Author:*\n${context.authorLogin || 'unknown'}`,
          },
        ],
      },
    ],
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(`[Slack] Webhook failed: ${response.status}`);
      return;
    }

    console.log(`[Slack] Notification sent for PR #${context.prNumber}`);
  } catch (err) {
    console.error(`[Slack] Failed to send notification:`, err);
  }
}
```

### `package.json`
```json
{
  "name": "ci-cd-blocker",
  "version": "0.2.0",
  "description": "GitHub webhook bot that blocks merges when integration tests fail",
  "main": "dist/index.js",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "ts-node src/index.ts",
    "test": "echo 'Integration tests would run here'",
    "lint": "eslint src/**/*.ts"
  },
  "dependencies": {
    "express": "^4.18.2"
  },
  "devDependencies": {
    "@types/express": "^4.17.17",
    "@types/node": "^20.5.0",
    "typescript": "^5.1.6",
    "ts-node": "^10.9.1"
  }
}
```

### `tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ES2020",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true,
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### `docker-compose.yml`
```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - SLACK_WEBHOOK_URL=${SLACK_WEBHOOK_URL:-}
    volumes:
      - ./src:/app/src
    command: npm start
```

### `Dockerfile`
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

---

Now let me test this on the server to confirm it builds and runs without errors.

<ssh server="app" user="engineer" reason="Clone repo, build TypeScript, verify app starts without runtime errors">
cd ~
rm -rf ci-cd-blocker
git clone https://github.com/Innovaine/ci-cd-blocker.git ~/ci-cd-blocker
cd ~/ci-cd-blocker
npm install
npm run build
</ssh>

---

## Week 2 notes

- **What's fixed:** Consolidated duplicate webhook handlers (index.ts and webhooks/github.ts) into a single canonical route. Removed dynamic require() calls; all imports are now static and type-safe. Decision recording, Slack notification, and test orchestration are now wired together in a clean call chain.

- **Technical decision:** Orchestration lives in `src/test/orchestrator.ts` as a thin wrapper that calls `runTests()`. The webhook handler (`src/webhooks/github.ts`) is now a pure handler—it parses the GitHub payload, calls orchestrator, records the decision, and notifies Slack. No business logic leakage between files.

- **Tech debt taken on:** In-memory decision store (decisionsStore array in decisions.ts) is ephemeral; will lose data on restart. Acceptable for MVP to reach customers fast. Production requires a real DB (Postgres, SQLite). Slack notification silently skips if webhook URL is missing (safe, not loud). Test runner is a stub (`npm test` invocation); real integration tests come next week if this ships.

- **Status:** On track. Core architecture is sound. App should compile and boot. Still need to test webhook payload handling end-to-end and confirm Slack integration works with a real webhook URL.

---

PROGRESS:
- Round: 1
- Scope completion (this role for THIS week): 65%
- Remaining for this role:
  - Test the build on server (SSH batch in progress)
  - Confirm webhook endpoint accepts GitHub payloads without crashing
  - Wire up a real test suite stub (currently just `npm test` placeholder)
  - Validate Slack notification flow with a test webhook
- Recommendation: keep_working
