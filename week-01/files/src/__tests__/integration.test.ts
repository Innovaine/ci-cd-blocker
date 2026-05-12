import express, { Express, Request, Response } from 'express';
import axios from 'axios';
import crypto from 'crypto';
import { orchestrateTests, TestOrchestratorConfig } from '../orchestration/testRunner';
import { notifySlack, SlackNotificationPayload } from '../notifications/slack';

// ASSUMPTION: For this integration test, we mock the staging server and Slack webhook
// ASSUMPTION: The real MVP will be tested against real staging + real Slack later (week 2)
// This test validates the CONTRACT between components, not the infrastructure

describe('End-to-end: webhook → orchestration → notification flow', () => {
  let stagingApp: Express;
  let stagingServer: any;
  let slackWebhookMock: any[];
  const stagingPort = 3001;
  const stagingUrl = `http://localhost:${stagingPort}`;

  beforeAll((done) => {
    stagingApp = express();
    stagingApp.use(express.json());

    // Mock staging server with /health and /test endpoints
    stagingApp.get('/health', (req: Request, res: Response) => {
      res.set('X-Deployed-Commit', 'abc1234');
      res.status(200).json({ status: 'healthy' });
    });

    stagingApp.post('/test', (req: Request, res: Response) => {
      const { commit } = req.body;
      // Simulate test pass for commit 'abc1234', fail for others
      if (commit === 'abc1234') {
        res.status(200).json({
          success: true,
          duration: 1250,
          output: 'All tests passed',
        });
      } else {
        res.status(200).json({
          success: false,
          duration: 2100,
          failures: [
            {
              name: 'integration/api.test.js',
              error: 'Expected 200, got 500',
            },
            {
              name: 'integration/auth.test.js',
              error: 'Timeout after 30s',
            },
          ],
          output: 'Test suite failed',
        });
      }
    });

    stagingServer = stagingApp.listen(stagingPort, done);
  });

  afterAll((done) => {
    stagingServer.close(done);
  });

  beforeEach(() => {
    slackWebhookMock = [];
    // Mock axios POST to Slack
    jest.spyOn(axios, 'post').mockImplementation((url, data) => {
      if (url.includes('slack.com')) {
        slackWebhookMock.push(data);
        return Promise.resolve({ status: 200, data: { ok: true } });
      }
      return axios.post(url, data);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should orchestrate tests against staging and return pass result', async () => {
    const config: TestOrchestratorConfig = {
      stagingUrl,
      timeout: 30000,
      retries: 2,
    };

    const result = await orchestrateTests(config, 'abc1234');

    expect(result.success).toBe(true);
    expect(result.duration).toBe(1250);
    expect(result.error).toBeUndefined();
  });

  it('should orchestrate tests and return fail result with details', async () => {
    const config: TestOrchestratorConfig = {
      stagingUrl,
      timeout: 30000,
      retries: 2,
    };

    const result = await orchestrateTests(config, 'def5678');

    expect(result.success).toBe(false);
    expect(result.duration).toBe(2100);
    expect(result.failures).toHaveLength(2);
    expect(result.failures?.[0].name).toContain('api.test.js');
  });

  it('should send Slack notification on test pass', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/mock';

    const payload: SlackNotificationPayload = {
      owner: 'test-org',
      repo: 'test-repo',
      prNumber: 42,
      prAuthor: 'developer',
      prTitle: 'Add new feature',
      testsPassed: true,
      testDetails: {
        duration: 1250,
      },
      commitSha: 'abc1234',
    };

    const success = await notifySlack(payload);

    expect(success).toBe(true);
    expect(slackWebhookMock).toHaveLength(1);
    const message = slackWebhookMock[0];
    expect(message.attachments[0].color).toBe('#36a64f'); // Green
  });

  it('should send Slack notification on test fail with override link', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/mock';

    const payload: SlackNotificationPayload = {
      owner: 'test-org',
      repo: 'test-repo',
      prNumber: 42,
      prAuthor: 'developer',
      prTitle: 'Add new feature',
      testsPassed: false,
      testDetails: {
        duration: 2100,
        failures: [
          {
            name: 'integration/api.test.js',
            error: 'Expected 200, got 500',
          },
        ],
      },
      commitSha: 'def5678',
      overrideUrl: 'http://localhost:3000/api/override',
    };

    const success = await notifySlack(payload);

    expect(success).toBe(true);
    expect(slackWebhookMock).toHaveLength(1);
    const message = slackWebhookMock[0];
    expect(message.attachments[0].color).toBe('#e03131'); // Red
    expect(message.attachments[0].actions).toBeDefined();
    expect(message.attachments[0].actions[0].text).toBe('Override Block');
  });

  it('should handle test orchestration timeout gracefully', async () => {
    const config: TestOrchestratorConfig = {
      stagingUrl: 'http://localhost:9999', // Non-existent server
      timeout: 3000,
      retries: 1,
    };

    const result = await orchestrateTests(config, 'abc1234');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed after 1 attempts');
  });

  it('should skip Slack notification if webhook URL not set', async () => {
    delete process.env.SLACK_WEBHOOK_URL;

    const payload: SlackNotificationPayload = {
      owner: 'test-org',
      repo: 'test-repo',
      prNumber: 42,
      prAuthor: 'developer',
      prTitle: 'Add new feature',
      testsPassed: true,
      testDetails: { duration: 1250 },
      commitSha: 'abc1234',
    };

    const success = await notifySlack(payload);

    expect(success).toBe(false);
    expect(slackWebhookMock).toHaveLength(0);
  });
});