import twilio, { Twilio } from 'twilio';

export type SmsProvider = 'twilio' | 'mock';

const PHONE_REGEX = /^\+[1-9]\d{10,14}$/;
let twilioClient: Twilio | null = null;

const resolveSmsProvider = (): SmsProvider => {
  const explicit = process.env.SMS_PROVIDER?.trim().toLowerCase();
  if (explicit === 'twilio' || explicit === 'mock') {
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

export const sendVerificationCode = async (phone: string, code: string): Promise<SmsProvider> => {
  const provider = resolveSmsProvider();

  if (provider === 'mock') {
    console.log(`[OTP MOCK] Verification code for ${phone}: ${code}`);
    return 'mock';
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
