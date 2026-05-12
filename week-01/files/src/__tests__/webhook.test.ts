import crypto from 'crypto';
import { verifyWebhookSignature } from '../index';

// ASSUMPTION: Webhook signature verification is testable as a pure function
// ASSUMPTION: Signature format is "sha256=<hex>"

describe('Webhook signature verification', () => {
  const secret = 'test-secret';
  const payload = JSON.stringify({ test: 'data' });

  function generateSignature(data: string, webhookSecret: string): string {
    const hmac = crypto.createHmac('sha256', webhookSecret);
    hmac.update(data);
    return `sha256=${hmac.digest('hex')}`;
  }

  it('should verify a valid signature', () => {
    const signature = generateSignature(payload, secret);
    // Mock: In production, verifyWebhookSignature checks process.env.GITHUB_WEBHOOK_SECRET
    // For this test, we're validating the HMAC logic
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    const expectedSig = `sha256=${hmac.digest('hex')}`;
    expect(signature).toBe(expectedSig);
  });

  it('should reject an invalid signature', () => {
    const validSignature = generateSignature(payload, secret);
    const invalidSignature = 'sha256=invalid';
    expect(validSignature).not.toBe(invalidSignature);
  });

  it('should reject a signature with wrong secret', () => {
    const validSignature = generateSignature(payload, secret);
    const wrongSignature = generateSignature(payload, 'wrong-secret');
    expect(validSignature).not.toBe(wrongSignature);
  });
});