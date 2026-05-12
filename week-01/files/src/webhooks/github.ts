import { Octokit } from '@octokit/rest';
import { runIntegrationTests } from '../integration-tests/runner';
import { logger } from '../utils/logger';
import { getRepoConfig } from '../config/repo-config';
import { recordBlockDecision } from '../state/decisions';

// ASSUMPTION: Each repo is configured with its staging environment URL in .env or a config file
// ASSUMPTION: The staging environment is already deployed and accessible; we do not trigger deploys

export async function handlePullRequestEvent(
  payload: any,
  githubToken: string
): Promise<void> {
  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;
  const prNumber = payload.pull_request.number;
  const headSha = payload.pull_request.head.sha;
  const baseRef = payload.pull_request.base.ref;

  logger.info(
    `Processing PR #${prNumber} in ${owner}/${repo} (sha: ${headSha})`
  );

  try {
    // Get repo-specific config (staging URL, timeout, etc.)
    const config = getRepoConfig(owner, repo);
    if (!config.stagingUrl) {
      logger.warn(
        `No staging URL configured for ${owner}/${repo}. Skipping test check.`
      );
      return;
    }

    // Set initial commit status to "pending"
    const octokit = new Octokit({ auth: githubToken });
    await octokit.repos.createCommitStatus({
      owner,
      repo,
      sha: headSha,
      state: 'pending',
      description: 'Running integration tests...',
      context: 'ci/cd-blocker',
    });

    // Run integration tests against staging
    const testResult = await runIntegrationTests(config.stagingUrl, {
      owner,
      repo,
      prNumber,
      headSha,
      timeout: config.testTimeoutMs || 60000,
    });

    // Decide whether to block merge
    const shouldBlock = !testResult.passed;

    // Update commit status
    await octokit.repos.createCommitStatus({
      owner,
      repo,
      sha: headSha,
      state: shouldBlock ? 'failure' : 'success',
      description: shouldBlock
        ? `Integration tests failed: ${testResult.failureCount} failures`
        : 'Integration tests passed',
      context: 'ci/cd-blocker',
      target_url: testResult.reportUrl || undefined,
    });

    // Record decision for audit and future Slack notification
    recordBlockDecision({
      owner,
      repo,
      prNumber,
      headSha,
      baseRef,
      blocked: shouldBlock,
      testsPassed: testResult.passed,
      failureCount: testResult.failureCount,
      failureDetails: testResult.failures,
      timestamp: new Date().toISOString(),
    });

    logger.info(
      `PR #${prNumber}: ${shouldBlock ? 'BLOCKED' : 'ALLOWED'} (${
        testResult.failureCount
      } test failures)`
    );
  } catch (error) {
    logger.error(
      `Failed to process PR #${prNumber} in ${owner}/${repo}: ${error}`
    );

    // Mark status as error so developer knows something went wrong
    const octokit = new Octokit({ auth: githubToken });
    await octokit.repos.createCommitStatus({
      owner,
      repo,
      sha: headSha,
      state: 'error',
      description: 'Error running integration tests',
      context: 'ci/cd-blocker',
    });

    throw error;
  }
}