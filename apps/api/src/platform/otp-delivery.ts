import { logger } from './logger.js';
import { sendOtpSms, smsConfigured } from './sms.js';
import { sendOtpWhatsapp, whatsappConfigured } from './whatsapp.js';

// Single entry point for OTP delivery. Prefers WhatsApp (free tier, no DLT),
// falls back to SMS, and in dev with neither configured just logs the code so
// the flow still works locally.
export async function deliverOtp(phone: string, code: string): Promise<void> {
  if (whatsappConfigured()) {
    await sendOtpWhatsapp(phone, code);
    return;
  }
  if (smsConfigured()) {
    await sendOtpSms(phone, code);
    return;
  }
  logger.info({ phone, code }, 'otp issued (no delivery channel configured — logged only)');
}
