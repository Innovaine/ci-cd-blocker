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