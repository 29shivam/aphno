import { describe, expect, it } from 'vitest';
import { generateOtp, hashOtp, signJwt, verifyJwt, verifyOtp } from './crypto.js';

describe('jwt', () => {
  it('round-trips a signed token', () => {
    const token = signJwt({ sub: 'user-1', phone: '+919999999999' });
    const payload = verifyJwt(token);
    expect(payload?.sub).toBe('user-1');
    expect(payload?.phone).toBe('+919999999999');
    expect(payload?.exp).toBeGreaterThan(payload!.iat);
  });

  it('rejects a tampered token', () => {
    const token = signJwt({ sub: 'user-1', phone: '+919999999999' });
    const [h, , s] = token.split('.');
    const forged = `${h}.${Buffer.from(JSON.stringify({ sub: 'admin' })).toString('base64url')}.${s}`;
    expect(verifyJwt(forged)).toBeNull();
  });

  it('rejects garbage', () => {
    expect(verifyJwt('not-a-token')).toBeNull();
    expect(verifyJwt('a.b.c')).toBeNull();
  });
});

describe('otp', () => {
  it('generates a 6-digit code', () => {
    for (let i = 0; i < 100; i++) {
      expect(generateOtp()).toMatch(/^[0-9]{6}$/);
    }
  });

  it('verifies only the matching code + phone', () => {
    const phone = '+919999999999';
    const code = '123456';
    const hash = hashOtp(phone, code);
    expect(verifyOtp(phone, code, hash)).toBe(true);
    expect(verifyOtp(phone, '654321', hash)).toBe(false);
    expect(verifyOtp('+910000000000', code, hash)).toBe(false);
  });
});
