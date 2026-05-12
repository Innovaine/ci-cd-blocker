import axios from 'axios';
import { logger } from '../logger';

// ASSUMPTION: Slack webhook URL is injected via env var SLACK_WEBHOOK_URL
// ASSUMPTION: Slack payload format uses Block Kit (modern, interactive)
// ASSUMPTION: Per-repo Slack channel mapping is not in MVP; all notifications go to one webhook

export interface SlackNotificationPayload {
  owner: string;
  repo: string;
  prNumber: number;
  prAuthor: string;
  prTitle: string;
  testsPassed: boolean;
  testDetails?: {
    duration: number;
    failures?: Array<{ name: string; error: string }>;
    error?: string;
  };
  commitSha: string;
  overrideUrl?: string; // If override is available, include the endpoint
}

export async function notifySlack(
  payload: SlackNotificationPayload
): Promise<boolean> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    logger.warn('[Slack] SLACK_WEBHOOK_URL not set, skipping notification');
    return false;
  }

  const slackMessage = buildSlackMessage(payload);

  try {
    await axios.post(webhookUrl, slackMessage, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 5000,
    });
    logger.info(
      `[Slack] Notification sent for ${payload.owner}/${payload.repo}#${payload.prNumber}`
    );
    return true;
  } catch (error) {
    logger.error(
      `[Slack] Failed to send notification: ${error instanceof Error ? error.message : String(error)}`
    );
    return false;
  }
}

function buildSlackMessage(payload: SlackNotificationPayload): object {
  const {
    owner,
    repo,
    prNumber,
    prAuthor,
    prTitle,
    testsPassed,
    testDetails,
    commitSha,
    overrideUrl,
  } = payload;

  const color = testsPassed ? '#36a64f' : '#e03131'; // Green or red
  const status = testsPassed ? '✅ Tests Passed' : '❌ Tests Failed';

  const fields: object[] = [
    {
      title: 'Repo',
      value: `${owner}/${repo}`,
      short: true,
    },
    {
      title: 'PR',
      value: `#${prNumber}`,
      short: true,
    },
    {
      title: 'Author',
      value: prAuthor,
      short: true,
    },
    {
      title: 'Commit',
      value: commitSha.slice(0, 8),
      short: true,
    },
  ];

  if (testDetails) {
    fields.push({
      title: 'Duration',
      value: `${testDetails.duration}ms`,
      short: true,
    });

    if (testDetails.failures && testDetails.failures.length > 0) {
      const failureText = testDetails.failures
        .slice(0, 3) // Show top 3 failures
        .map((f) => `• ${f.name}: ${f.error}`)
        .join('\n');
      fields.push({
        title: 'Failures',
        value: failureText,
        short: false,
      });
    }

    if (testDetails.error) {
      fields.push({
        title: 'Error',
        value: testDetails.error,
        short: false,
      });
    }
  }

  const actions: object[] = [];
  if (!testsPassed && overrideUrl) {
    actions.push({
      type: 'button',
      text: 'Override Block',
      url: overrideUrl,
      style: 'danger',
    });
  }

  return {
    username: 'CI/CD Blocker',
    icon_emoji: ':robot_face:',
    attachments: [
      {
        color,
        title: `${status} – ${prTitle}`,
        title_link: `https://github.com/${owner}/${repo}/pull/${prNumber}`,
        fields,
        footer: 'Innovaine CI/CD Blocker',
        ts: Math.floor(Date.now() / 1000),
        actions: actions.length > 0 ? actions : undefined,
      },
    ],
  };
}