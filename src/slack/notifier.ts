/**
 * Send notifications to Slack.
 * 
 * ASSUMPTION: Slack webhook URL is provided via SLACK_WEBHOOK_URL environment variable.
 * If not set, notifications are logged but not sent (silent fail for MVP).
 */
export async function notifySlack(message: string): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    console.log(`[Slack] Webhook URL not configured. Message not sent: ${message}`);
    return;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message }),
    });

    if (!response.ok) {
      console.warn(`[Slack] Failed to send notification. Status: ${response.status}`);
    } else {
      console.log(`[Slack] Notification sent: ${message}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`[Slack] Notification failed: ${errorMessage}`);
  }
}