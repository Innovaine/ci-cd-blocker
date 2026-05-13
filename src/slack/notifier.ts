import axios from 'axios';

export interface SlackNotification {
  channel: string;
  message: string;
  details?: Record<string, string>;
}

export async function notifySlack(notification: SlackNotification): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    console.warn('[Slack] SLACK_WEBHOOK_URL not set; skipping notification');
    return;
  }

  try {
    const fields = notification.details
      ? Object.entries(notification.details).map(([key, value]) => ({
          type: 'mrkdwn',
          text: `*${key}:*\n${value}`,
        }))
      : [];

    const payload = {
      channel: notification.channel,
      text: notification.message,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: notification.message,
          },
        },
        ...(fields.length > 0
          ? [
              {
                type: 'section',
                fields,
              },
            ]
          : []),
      ],
    };

    await axios.post(webhookUrl, payload, { timeout: 5000 });
    console.log(`[Slack] Notification sent to ${notification.channel}`);
  } catch (error) {
    console.error('[Slack] Failed to send notification:', error instanceof Error ? error.message : String(error));
    // Don't throw; Slack outage shouldn't block the webhook handler
  }
}