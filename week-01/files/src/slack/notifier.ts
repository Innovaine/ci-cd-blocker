import axios from 'axios';
import { logger } from '../utils/logger';

// ASSUMPTION: Slack webhook URL comes from environment variable SLACK_WEBHOOK_URL
// ASSUMPTION: One webhook per deployment (can add per-channel routing in week 2)
// ASSUMPTION: Slack message format is JSON payload to incoming webhook

export interface BlockNotification {
  owner: string;
  repo: string;
  prNumber: number;
  prTitle: string;
  prAuthor: string;
  failureCount: number;
  failureDetails: Array<{ name: string; error: string }>;
}

export interface OverrideNotification {
  owner: string;
  repo: string;
  prNumber: number;
  prTitle: string;
  overriddenBy: string;
}

async function sendSlackMessage(payload: Record<string, unknown>): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  
  if (!webhookUrl) {
    logger.warn('SLACK_WEBHOOK_URL not set; skipping Slack notification');
    return;
  }

  try {
    await axios.post(webhookUrl, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 5000,
    });
    logger.info('Slack notification sent successfully');
  } catch (error) {
    logger.error(`Failed to send Slack notification: ${error instanceof Error ? error.message : String(error)}`);
    // Don't throw; Slack outage shouldn't block the merge decision
  }
}

export async function notifyBlockedPR(notification: BlockNotification): Promise<void> {
  const failureText = notification.failureDetails
    .map((f) => `• *${f.name}*: ${f.error}`)
    .join('\n');

  const payload = {
    text: `PR blocked: ${notification.owner}/${notification.repo}#${notification.prNumber}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🚫 Merge Blocked — Integration Tests Failed',
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Repo*\n${notification.owner}/${notification.repo}`,
          },
          {
            type: 'mrkdwn',
            text: `*PR*\n#${notification.prNumber}`,
          },
          {
            type: 'mrkdwn',
            text: `*Author*\n${notification.prAuthor}`,
          },
          {
            type: 'mrkdwn',
            text: `*Failures*\n${notification.failureCount}`,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Title*: ${notification.prTitle}`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Test Failures*:\n${failureText}`,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View PR',
              emoji: true,
            },
            url: `https://github.com/${notification.owner}/${notification.repo}/pull/${notification.prNumber}`,
            style: 'danger',
          },
        ],
      },
    ],
  };

  await sendSlackMessage(payload);
}

export async function notifyOverriddenPR(notification: OverrideNotification): Promise<void> {
  const payload = {
    text: `PR override: ${notification.owner}/${notification.repo}#${notification.prNumber}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '⚠️ Merge Blocked — Override Applied',
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Repo*\n${notification.owner}/${notification.repo}`,
          },
          {
            type: 'mrkdwn',
            text: `*PR*\n#${notification.prNumber}`,
          },
          {
            type: 'mrkdwn',
            text: `*Overridden By*\n${notification.overriddenBy}`,
          },
          {
            type: 'mrkdwn',
            text: `*Action*\nMerge Allowed`,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Title*: ${notification.prTitle}`,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: 'This PR was manually approved to merge despite test failures. Audit trail recorded.',
          },
        ],
      },
    ],
  };

  await sendSlackMessage(payload);
}