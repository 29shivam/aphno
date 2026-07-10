import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  DATABASE_URL: z.string().url(),
  // Secret for signing auth JWTs. MUST be overridden in production.
  JWT_SECRET: z.string().min(16).default('dev-insecure-secret-change-me-please'),
  JWT_TTL_SEC: z.coerce
    .number()
    .int()
    .positive()
    .default(60 * 60 * 24 * 30), // 30d
  OTP_TTL_SEC: z.coerce.number().int().positive().default(300), // 5 min
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  // Twilio SMS (optional — if unset, OTPs are logged instead of sent).
  // Account SID (AC…) is always needed for the request URL. Authenticate with
  // EITHER an API Key (SK… + secret, recommended) OR the account Auth Token.
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_API_KEY_SID: z.string().optional(),
  TWILIO_API_KEY_SECRET: z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional(),
});

export const env = EnvSchema.parse(process.env);

export const isProd = env.NODE_ENV === 'production';
