import { applyOverride, OverrideRequest } from '../auth/override';

// ASSUMPTION: Override token is validated against OVERRIDE_TOKEN env var
// ASSUMPTION: applyOverride returns { success, message }

describe('Override token validation', () => {
  it('should reject override with missing token', async () => {
    const invalidReq: OverrideRequest = {
      owner: 'test-owner',
      repo: 'test-repo',
      prNumber: 1,
      token: '',
      overriddenBy: 'test-user',
    };

    const result = await applyOverride(invalidReq);
    expect(result.success).toBe(false);
    expect(result.message).toContain('Invalid or missing token');
  });

  it('should reject override with wrong token', async () => {
    process.env.OVERRIDE_TOKEN = 'correct-token';

    const invalidReq: OverrideRequest = {
      owner: 'test-owner',
      repo: 'test-repo',
      prNumber: 1,
      token: 'wrong-token',
      overriddenBy: 'test-user',
    };

    const result = await applyOverride(invalidReq);
    expect(result.success).toBe(false);
  });

  it('should accept override with correct token', async () => {
    process.env.OVERRIDE_TOKEN = 'correct-token';

    const validReq: OverrideRequest = {
      owner: 'test-owner',
      repo: 'test-repo',
      prNumber: 1,
      token: 'correct-token',
      overriddenBy: 'test-user',
    };

    const result = await applyOverride(validReq);
    expect(result.success).toBe(true);
  });
});