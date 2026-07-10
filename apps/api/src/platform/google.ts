import { env } from './env.js';

export interface GoogleProfile {
  sub: string; // stable Google user id
  email: string;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
}

export class GoogleAuthError extends Error {
  statusCode = 401;
  code = 'GOOGLE_AUTH_FAILED';
}

interface TokenInfo {
  aud?: string;
  sub?: string;
  email?: string;
  email_verified?: string | boolean;
  name?: string;
  picture?: string;
  iss?: string;
  exp?: string;
}

/**
 * Verify a Google ID token and return the profile. Uses Google's tokeninfo
 * endpoint, which validates the signature/expiry server-side; we additionally
 * check the audience matches our client id and the issuer is Google.
 */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleProfile> {
  if (!env.GOOGLE_CLIENT_ID) {
    throw new GoogleAuthError('Google sign-in is not configured');
  }

  const res = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
  );
  if (!res.ok) throw new GoogleAuthError('invalid Google token');

  const info = (await res.json()) as TokenInfo;

  const validIssuer =
    info.iss === 'accounts.google.com' || info.iss === 'https://accounts.google.com';
  if (!validIssuer) throw new GoogleAuthError('unexpected token issuer');
  if (info.aud !== env.GOOGLE_CLIENT_ID) throw new GoogleAuthError('token audience mismatch');
  if (!info.sub || !info.email) throw new GoogleAuthError('token missing subject or email');

  const emailVerified = info.email_verified === true || info.email_verified === 'true';
  if (!emailVerified) throw new GoogleAuthError('Google email is not verified');

  return {
    sub: info.sub,
    email: info.email.toLowerCase(),
    emailVerified,
    name: info.name ?? null,
    picture: info.picture ?? null,
  };
}
