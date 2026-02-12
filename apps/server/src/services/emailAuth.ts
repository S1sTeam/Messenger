import nodemailer from 'nodemailer';

export type EmailProvider = 'gmail' | 'smtp' | 'mock';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const resolveEmailProvider = (): EmailProvider => {
  const explicit = process.env.EMAIL_PROVIDER?.trim().toLowerCase();
  if (explicit === 'gmail' || explicit === 'smtp' || explicit === 'mock') {
    return explicit;
  }

  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    return 'gmail';
  }

  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return 'smtp';
  }

  return 'mock';
};

export const normalizeEmail = (value: string): string => {
  return (value || '').trim().toLowerCase();
};

export const isValidEmail = (value: string): boolean => {
  return EMAIL_REGEX.test(value);
};

export const sendVerificationCodeByEmail = async (
  email: string,
  code: string
): Promise<EmailProvider> => {
  const provider = resolveEmailProvider();

  if (provider === 'mock') {
    console.log(`[OTP MOCK EMAIL] Verification code for ${email}: ${code}`);
    return 'mock';
  }

  const subject = 'Код входа в Messenger';
  const text = `Ваш код входа в Messenger: ${code}
Код действует 5 минут.
Никому не сообщайте этот код.`;

  if (provider === 'gmail') {
    const gmailUser = process.env.GMAIL_USER?.trim();
    const gmailAppPassword = process.env.GMAIL_APP_PASSWORD?.trim();
    if (!gmailUser || !gmailAppPassword) {
      throw new Error('GMAIL_USER or GMAIL_APP_PASSWORD is missing');
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailUser,
        pass: gmailAppPassword,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_FROM?.trim() || gmailUser,
      to: email,
      subject,
      text,
    });

    return 'gmail';
  }

  const smtpHost = process.env.SMTP_HOST?.trim();
  const smtpPortRaw = process.env.SMTP_PORT?.trim() || '587';
  const smtpUser = process.env.SMTP_USER?.trim();
  const smtpPass = process.env.SMTP_PASS?.trim();

  if (!smtpHost || !smtpUser || !smtpPass) {
    throw new Error('SMTP_HOST, SMTP_USER, SMTP_PASS are required for SMTP provider');
  }

  const smtpPort = Number.parseInt(smtpPortRaw, 10);
  if (!Number.isFinite(smtpPort)) {
    throw new Error('SMTP_PORT must be a valid number');
  }

  const secureFlag = process.env.SMTP_SECURE?.trim();
  const secure =
    secureFlag === 'true' || secureFlag === '1'
      ? true
      : secureFlag === 'false' || secureFlag === '0'
        ? false
        : smtpPort === 465;

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  await transporter.sendMail({
    from: process.env.EMAIL_FROM?.trim() || smtpUser,
    to: email,
    subject,
    text,
  });

  return 'smtp';
};
