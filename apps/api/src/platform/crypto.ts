import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { env } from './env.js';

// ── Minimal HS256 JWT (no external dependency) ───────────────────────────────

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function b64urlDecode(input: string): Buffer {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

function sign(data: string): string {
  return b64url(createHmac('sha256', env.JWT_SECRET).update(data).digest());
}

export interface JwtPayload {
  sub: string; // userId
  phone: string;
  iat: number;
  exp: number;
}

export function signJwt(payload: { sub: string; phone: string | null }): string {
  const now = Math.floor(Date.now() / 1000);
  const body: JwtPayload = {
    sub: payload.sub,
    phone: payload.phone ?? '',
    iat: now,
    exp: now + env.JWT_TTL_SEC,
  };
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify(body));
  const unsigned = `${header}.${claims}`;
  return `${unsigned}.${sign(unsigned)}`;
}

export function verifyJwt(token: string): JwtPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, claims, signature] = parts as [string, string, string];
  const expected = sign(`${header}.${claims}`);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(b64urlDecode(claims).toString('utf8')) as JwtPayload;
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// ── OTP ──────────────────────────────────────────────────────────────────────

export function generateOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

// Deterministic keyed hash so we can store & compare without a slow KDF.
// OTPs are short-lived and rate-limited, so an HMAC is sufficient here.
export function hashOtp(phone: string, code: string): string {
  return createHmac('sha256', env.JWT_SECRET).update(`${phone}:${code}`).digest('hex');
}

export function verifyOtp(phone: string, code: string, storedHash: string): boolean {
  const candidate = Buffer.from(hashOtp(phone, code));
  const stored = Buffer.from(storedHash);
  return candidate.length === stored.length && timingSafeEqual(candidate, stored);
}
