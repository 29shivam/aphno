import { env } from './env.js';
import { logger } from './logger.js';

export class WhatsappError extends Error {
  statusCode = 502;
  code = 'WHATSAPP_SEND_FAILED';
}

export function whatsappConfigured(): boolean {
  return Boolean(
    env.WHATSAPP_PHONE_NUMBER_ID && env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_TEMPLATE_NAME,
  );
}

/**
 * Deliver the OTP over WhatsApp via Meta's Cloud API using an approved
 * authentication-category template. The template's body must contain a single
 * `{{1}}` variable (the code); Meta also mirrors the code into the template's
 * one-tap / copy-code button, so we pass it to the button component too.
 *
 * `phone` is E.164 (+9199…); WhatsApp wants it without the leading `+`.
 */
export async function sendOtpWhatsapp(phone: string, code: string): Promise<void> {
  const to = phone.replace(/^\+/, '');
  const url = `https://graph.facebook.com/${env.WHATSAPP_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: env.WHATSAPP_TEMPLATE_NAME,
      language: { code: env.WHATSAPP_TEMPLATE_LANG },
      components: [
        { type: 'body', parameters: [{ type: 'text', text: code }] },
        {
          type: 'button',
          sub_type: 'url',
          index: '0',
          parameters: [{ type: 'text', text: code }],
        },
      ],
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    // Never log the code on the delivery path.
    logger.error({ phone, status: res.status, detail }, 'whatsapp send failed');
    throw new WhatsappError('could not send the WhatsApp verification code');
  }
}
