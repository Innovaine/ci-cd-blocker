export async function notifySlack(channel: string, decision: any): Promise<void> {
  // ASSUMPTION: In MVP, Slack is a stub. No real token, no real HTTP call.
  console.log(`[slack] Would notify ${channel}: ${decision.status} decision for ${decision.owner}/${decision.repo}#${decision.prNumber}`);
  // Do nothing. No real webhook or token.
}