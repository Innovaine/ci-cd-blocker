import axios from 'axios';

export interface SlackNotification {
  channel: string;
  message: string;
  details?: Record<string, any>;
}

export async function notifySlack(notification: SlackNotification): Promise<void> {
  // ASSUMPTION: Slack webhook URL is provided via environment variable
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    console.warn('[Slack] SLACK_WEBHOOK_URL not set; skipping notification');
    return;
  }

  try {
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
        ...(notification.details
          ? [
              {
                type: 'section',
                fields: Object.entries(notification.details).map(([key, value]) => ({
                  type: 'mrkdwn',
                  text: `*${key}:*\n${value}`,
                })),
              },
            ]
          : []),
      ],
    };

    await axios.post(webhookUrl, payload, { timeout: 5000 });
    console.log(`[Slack] Notification sent to ${notification.channel}`);
  } catch (error) {
    console.error('[Slack] Failed to send notification:', error);
    // Don't throw; Slack outage shouldn't block the webhook handler
  }
}