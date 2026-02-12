import twilio, { Twilio } from 'twilio';

export type SmsProvider = 'twilio' | 'textbelt' | 'telegram' | 'mock';
export interface SendCodeOptions {
  telegramChatId?: string;
}

const PHONE_REGEX = /^\+[1-9]\d{10,14}$/;
let twilioClient: Twilio | null = null;
const textbeltEndpoint = process.env.TEXTBELT_ENDPOINT || 'https://textbelt.com/text';
const textbeltKey = process.env.TEXTBELT_KEY || 'textbelt';

const resolveSmsProvider = (): SmsProvider => {
  const explicit = process.env.SMS_PROVIDER?.trim().toLowerCase();
  if (explicit === 'twilio' || explicit === 'textbelt' || explicit === 'telegram' || explicit === 'mock') {
    return explicit;
  }

  const hasTwilioCreds =
    Boolean(process.env.TWILIO_ACCOUNT_SID) &&
    Boolean(process.env.TWILIO_AUTH_TOKEN) &&
    Boolean(process.env.TWILIO_FROM_NUMBER);

  return hasTwilioCreds ? 'twilio' : 'mock';
};

export const normalizePhoneNumber = (value: string): string => {
  const raw = (value || '').trim();
  if (!raw) return '';

  const keepPlusAndDigits = raw.replace(/[^\d+]/g, '');
  const startsWithPlus = keepPlusAndDigits.startsWith('+');
  const digitsOnly = keepPlusAndDigits.replace(/\D/g, '');

  if (digitsOnly.startsWith('8') && digitsOnly.length === 11) {
    return `+7${digitsOnly.slice(1)}`;
  }

  if (startsWithPlus) {
    return `+${digitsOnly}`;
  }

  return `+${digitsOnly}`;
};

export const isValidPhoneNumber = (value: string): boolean => {
  return PHONE_REGEX.test(value);
};

const getTwilioClient = (): Twilio => {
  if (twilioClient) {
    return twilioClient;
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    throw new Error('Twilio credentials are missing');
  }

  twilioClient = twilio(accountSid, authToken);
  return twilioClient;
};

export const sendVerificationCode = async (
  phone: string,
  code: string,
  options: SendCodeOptions = {}
): Promise<SmsProvider> => {
  const provider = resolveSmsProvider();

  if (provider === 'mock') {
    console.log(`[OTP MOCK] Verification code for ${phone}: ${code}`);
    return 'mock';
  }

  if (provider === 'textbelt') {
    const body = new URLSearchParams({
      phone,
      message: `Messenger code: ${code}. Expires in 5 minutes.`,
      key: textbeltKey,
    });

    const response = await fetch(textbeltEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.success) {
      const reason = payload.error || `Textbelt HTTP ${response.status}`;
      throw new Error(`Textbelt send failed: ${reason}`);
    }

    return 'textbelt';
  }

  if (provider === 'telegram') {
    const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
    const chatId = options.telegramChatId?.trim() || process.env.TELEGRAM_CHAT_ID?.trim();

    if (!botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN is missing');
    }

    if (!chatId) {
      throw new Error('TELEGRAM_CHAT_ID is missing');
    }

    const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `Messenger code for ${phone}: ${code}\nValid for 5 minutes.`,
      }),
    });

    const telegramPayload = await telegramResponse.json().catch(() => ({}));
    if (!telegramResponse.ok || !telegramPayload.ok) {
      const reason = telegramPayload.description || `Telegram HTTP ${telegramResponse.status}`;
      throw new Error(`Telegram send failed: ${reason}`);
    }

    return 'telegram';
  }

  const fromNumber = process.env.TWILIO_FROM_NUMBER;
  if (!fromNumber) {
    throw new Error('TWILIO_FROM_NUMBER is missing');
  }

  const client = getTwilioClient();
  await client.messages.create({
    to: phone,
    from: fromNumber,
    body: `Messenger code: ${code}. Expires in 5 minutes.`,
  });

  return 'twilio';
};
