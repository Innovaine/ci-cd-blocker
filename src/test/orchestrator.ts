import { RepoConfig } from '../config/repo-config';
import { runIntegrationTests } from './runner';

export interface TestContext {
  owner: string;
  repo: string;
  prNumber: number;
  baseSha: string;
  headSha: string;
  branch: string;
}

export interface TestResult {
  passed: boolean;
  failureReason?: string;
  testsDuration?: number;
}

export async function orchestrateTests(
  config: RepoConfig,
  context: TestContext
): Promise<TestResult> {
  // ASSUMPTION: orchestrateTests runs integration tests in a staging environment
  // For MVP, we assume staging is pre-deployed and we just run tests against it
  // Future: add staging deployment step before tests

  console.log(
    `[Orchestrator] Running tests for ${context.owner}/${context.repo} PR #${context.prNumber}`
  );

  try {
    const result = await runIntegrationTests({
      repoOwner: context.owner,
      repoName: context.repo,
      headSha: context.headSha,
      stagingUrl: config.stagingUrl || 'http://localhost:3001', // ASSUMPTION: default staging
    });

    return {
      passed: result.success,
      failureReason: result.failureReason,
      testsDuration: result.duration,
    };
  } catch (error) {
    console.error(`[Orchestrator] Test runner crashed:`, error);
    throw new Error(`Test orchestration failed: ${String(error)}`);
  }
}