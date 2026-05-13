/**
 * slack/notifier.ts
 * Sends notifications to Slack.
 * 
 * ASSUMPTION: Slack webhook URL is provided via SLACK_WEBHOOK_URL env var.
 * For MVP, we log the intent but do not actually make HTTP calls.
 * Next cycle: integrate with real Slack API.
 */

export interface SlackNotification {
  channel: string;
  message: string;
  color?: 'good' | 'warning' | 'danger';
  details?: Record<string, unknown>;
}

/**
 * notifySlack
 * Sends a notification to a Slack channel.
 */
export async function notifySlack(notification: SlackNotification): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  console.log(`[slack] Notification queued for ${notification.channel}`, {
    message: notification.message,
    color: notification.color || 'good',
  });

  if (!webhookUrl) {
    console.warn(
      `[slack] SLACK_WEBHOOK_URL not set. Notification not sent. Message: ${notification.message}`
    );
    return;
  }

  // ASSUMPTION: For MVP, we log the intent but do not send to Slack.
  // This avoids dependency on external service during early testing.
  // Next cycle: uncomment the fetch call below.

  /*
  try {
    const payload = {
      text: notification.message,
      attachments: [
        {
          color: notification.color || 'good',
          text: JSON.stringify(notification.details || {}),
        },
      ],
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Slack API returned ${response.status}`);
    }

    console.log(`[slack] Notification sent to ${notification.channel}`);
  } catch (error) {
    console.error(`[slack] Error sending notification:`, error);
  }
  */
}