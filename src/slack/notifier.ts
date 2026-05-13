import { DecisionRecord } from '../db/decisions';

export async function notifySlack(decision: DecisionRecord): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    console.log('[Slack] SLACK_WEBHOOK_URL not set; skipping notification');
    return;
  }

  const statusEmoji = decision.testsPassed ? '✅' : '❌';
  const statusText = decision.testsPassed ? 'Tests Passed' : 'Tests Failed';
  const overrideText = decision.overridden ? ` (Overridden: ${decision.overrideReason})` : '';

  const message = {
    text: `CI/CD Decision for ${decision.owner}/${decision.repo} PR #${decision.prNumber}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text:
            `*${decision.owner}/${decision.repo} PR #${decision.prNumber}*\n` +
            `${statusEmoji} ${statusText}${overrideText}\n` +
            `<t:${Math.floor(decision.timestamp / 1000)}:f>`,
        },
      },
    ],
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      throw new Error(`Slack API returned ${response.status}`);
    }

    console.log('[Slack] Notification sent successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Slack] Failed to send notification:', message);
    throw error;
  }
}