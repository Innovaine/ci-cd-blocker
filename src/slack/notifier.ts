export interface SlackMessage {
  owner: string;
  repo: string;
  prNumber: number;
  status: 'blocked' | 'approved' | 'error';
  reason: string;
}

/**
 * Notify Slack of a merge decision.
 * ASSUMPTION: SLACK_WEBHOOK_URL env var is optional. If not set, no-op.
 */
export async function notifySlack(message: SlackMessage): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    console.log(`[slack] No SLACK_WEBHOOK_URL set, skipping notification`);
    return;
  }

  try {
    const statusEmoji = message.status === 'blocked' ? '🚫' : '✅';
    const payload = {
      text: `${statusEmoji} Merge ${message.status}: ${message.owner}/${message.repo}#${message.prNumber}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Merge ${message.status}*\n${message.owner}/${message.repo}#${message.prNumber}\n_${message.reason}_`,
          },
        },
      ],
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(`[slack] POST failed: ${response.status}`);
    } else {
      console.log(`[slack] Notification sent`);
    }
  } catch (err) {
    console.error(`[slack] Error sending notification:`, err);
  }
}