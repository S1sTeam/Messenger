import nodemailer from 'nodemailer';

export type EmailProvider = 'gmail' | 'smtp' | 'mock';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_LENGTH = 6;
const OTP_TTL_MINUTES = 5;

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

const buildVerificationEmail = (code: string) => {
  const safeCode = (code || '').replace(/[^\d]/g, '').slice(0, OTP_LENGTH) || code;

  const subject = 'Код входа в Messenger';
  const text = [
    `Ваш код входа в Messenger: ${safeCode}`,
    `Код действует ${OTP_TTL_MINUTES} минут.`,
    'Никому не сообщайте этот код.',
  ].join('\n');

  const html = `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Код входа Messenger</title>
  </head>
  <body style="margin:0;padding:0;background:#0b1220;color:#e5e7eb;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0b1220;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#111827;border:1px solid #1f2937;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:28px 28px 12px 28px;">
                <div style="display:inline-block;padding:8px 12px;border-radius:999px;background:#172554;color:#93c5fd;font:600 12px/1.2 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                  Messenger Security
                </div>
                <h1 style="margin:16px 0 8px 0;font:700 24px/1.2 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f9fafb;">
                  Подтвердите вход
                </h1>
                <p style="margin:0 0 18px 0;font:400 15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#9ca3af;">
                  Используйте этот код для входа в ваш аккаунт Messenger.
                </p>
                <div style="margin:0 0 14px 0;padding:16px 18px;border-radius:12px;background:#0f172a;border:1px solid #1e293b;text-align:center;">
                  <span style="display:block;font:700 36px/1.1 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono','Courier New',monospace;letter-spacing:8px;color:#38bdf8;">
                    ${safeCode}
                  </span>
                </div>
                <p style="margin:0;font:500 13px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#93c5fd;">
                  Код действует ${OTP_TTL_MINUTES} минут.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 28px 28px;">
                <div style="margin-top:18px;padding-top:16px;border-top:1px solid #1f2937;">
                  <p style="margin:0;font:400 12px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#9ca3af;">
                    Если вы не запрашивали этот код, просто проигнорируйте письмо.
                    Никому не сообщайте код, включая службу поддержки.
                  </p>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
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

  const mailContent = buildVerificationEmail(code);
  const fromName = process.env.EMAIL_FROM_NAME?.trim() || 'Messenger';

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
      from: `${fromName} <${process.env.EMAIL_FROM?.trim() || gmailUser}>`,
      to: email,
      subject: mailContent.subject,
      text: mailContent.text,
      html: mailContent.html,
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
    from: `${fromName} <${process.env.EMAIL_FROM?.trim() || smtpUser}>`,
    to: email,
    subject: mailContent.subject,
    text: mailContent.text,
    html: mailContent.html,
  });

  return 'smtp';
};
