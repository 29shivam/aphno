import { env } from './env.js';
import { logger } from './logger.js';

const TWILIO_BASE = 'https://api.twilio.com/2010-04-01';

export function smsConfigured(): boolean {
  return Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM_NUMBER);
}

/**
 * Send the OTP to `phone` (E.164, e.g. +9199…) via Twilio's REST API.
 * If Twilio isn't configured, logs the code instead so local/dev still works.
 */
export async function sendOtpSms(phone: string, code: string): Promise<void> {
  const body = `Your aphno.ai verification code is ${code}. It expires in 5 minutes.`;

  if (!smsConfigured()) {
    logger.info({ phone, code }, 'otp issued (SMS not configured — logged only)');
    return;
  }

  const auth = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64');
  const params = new URLSearchParams({
    To: phone,
    From: env.TWILIO_FROM_NUMBER as string,
    Body: body,
  });

  const res = await fetch(`${TWILIO_BASE}/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: 'POST',
    headers: {
      authorization: `Basic ${auth}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    // Never log the code on the SMS path.
    logger.error({ phone, status: res.status, detail }, 'twilio send failed');
    throw new SmsError('could not send the verification SMS');
  }
}

export class SmsError extends Error {
  statusCode = 502;
  code = 'SMS_SEND_FAILED';
}
