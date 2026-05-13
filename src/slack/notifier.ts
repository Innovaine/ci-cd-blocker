import { DecisionRecord } from '../db/decisions';

export async function notifySlack(decision: DecisionRecord): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    console.warn('[Slack] SLACK_WEBHOOK_URL not configured, skipping notification');
    return;
  }

  const message = {
    text: `CI/CD Decision for ${decision.owner}/${decision.repo} PR #${decision.prNumber}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${decision.owner}/${decision.repo} PR #${decision.prNumber}*\n` +
                `Status: ${decision.testsPassed ? '✅ Tests Passed' : '❌ Tests Failed'}\n` +
                `Overridden: ${decision.overridden ? 'Yes' : 'No'}`,
        },
      },
    ],
  };

  if (decision.overrideReason) {
    message.blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Override Reason:* ${decision.overrideReason}`,
      },
    });
  }

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
    throw new Error(`Slack notification failed: ${message}`);
  }
}