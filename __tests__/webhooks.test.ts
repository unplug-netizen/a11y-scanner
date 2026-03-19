import { 
  generateWebhookSignature, 
  verifyWebhookSignature,
  generateWebhookSecret 
} from '@/lib/webhooks';

describe('Webhooks', () => {
  describe('generateWebhookSignature', () => {
    it('should generate consistent HMAC signatures', () => {
      const payload = JSON.stringify({ event: 'scan.completed', data: { test: true } });
      const secret = 'test-secret-123';
      
      const sig1 = generateWebhookSignature(payload, secret);
      const sig2 = generateWebhookSignature(payload, secret);
      
      expect(sig1).toBe(sig2);
      expect(sig1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
    });

    it('should generate different signatures for different payloads', () => {
      const secret = 'test-secret-123';
      const payload1 = JSON.stringify({ event: 'scan.completed' });
      const payload2 = JSON.stringify({ event: 'issue.detected' });
      
      const sig1 = generateWebhookSignature(payload1, secret);
      const sig2 = generateWebhookSignature(payload2, secret);
      
      expect(sig1).not.toBe(sig2);
    });

    it('should generate different signatures for different secrets', () => {
      const payload = JSON.stringify({ event: 'scan.completed' });
      
      const sig1 = generateWebhookSignature(payload, 'secret-1');
      const sig2 = generateWebhookSignature(payload, 'secret-2');
      
      expect(sig1).not.toBe(sig2);
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should verify valid signatures', () => {
      const payload = JSON.stringify({ event: 'scan.completed', data: { test: true } });
      const secret = 'test-secret-123';
      const signature = generateWebhookSignature(payload, secret);
      
      expect(verifyWebhookSignature(payload, signature, secret)).toBe(true);
    });

    it('should reject invalid signatures', () => {
      const payload = JSON.stringify({ event: 'scan.completed' });
      const secret = 'test-secret-123';
      
      expect(verifyWebhookSignature(payload, 'invalid-signature', secret)).toBe(false);
    });

    it('should reject signatures with wrong secret', () => {
      const payload = JSON.stringify({ event: 'scan.completed' });
      const signature = generateWebhookSignature(payload, 'correct-secret');
      
      expect(verifyWebhookSignature(payload, signature, 'wrong-secret')).toBe(false);
    });

    it('should reject tampered payloads', () => {
      const originalPayload = JSON.stringify({ event: 'scan.completed', data: { count: 5 } });
      const tamperedPayload = JSON.stringify({ event: 'scan.completed', data: { count: 10 } });
      const secret = 'test-secret-123';
      const signature = generateWebhookSignature(originalPayload, secret);
      
      expect(verifyWebhookSignature(tamperedPayload, signature, secret)).toBe(false);
    });
  });

  describe('generateWebhookSecret', () => {
    it('should generate 64-character hex strings', () => {
      const secret = generateWebhookSecret();
      
      expect(secret).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should generate unique secrets', () => {
      const secrets = new Set();
      for (let i = 0; i < 100; i++) {
        secrets.add(generateWebhookSecret());
      }
      
      expect(secrets.size).toBe(100);
    });
  });
});
