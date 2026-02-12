import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { createHash, randomBytes, randomInt } from 'crypto';
import { prisma } from '../db.js';
import {
  getSmsProvider,
  isValidPhoneNumber,
  normalizePhoneNumber,
  sendVerificationCode,
} from '../services/phoneAuth.js';

export const authRouter = Router();
const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

const signToken = (userId: string): string => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

const hashCode = (code: string): string => {
  return createHash('sha256').update(code).digest('hex');
};

const toAuthUser = (user: {
  id: string;
  phone: string;
  username: string | null;
  displayName: string;
  avatar: string | null;
}) => ({
  id: user.id,
  phone: user.phone,
  username: user.username || undefined,
  displayName: user.displayName,
  avatar: user.avatar || undefined,
});

authRouter.post('/send-code', async (req, res) => {
  try {
    const normalizedPhone = normalizePhoneNumber(req.body?.phone || '');
    const telegramChatId = String(req.body?.telegramChatId || '').trim();
    if (!isValidPhoneNumber(normalizedPhone)) {
      return res.status(400).json({
        error: 'Введите номер в международном формате, например +79991234567',
      });
    }

    const smsProvider = getSmsProvider();
    let resolvedTelegramChatId: string | undefined;

    if (smsProvider === 'telegram') {
      if (telegramChatId.length > 0) {
        if (!/^-?\d+$/.test(telegramChatId)) {
          return res.status(400).json({ error: 'Telegram chat id должен быть числом' });
        }

        resolvedTelegramChatId = telegramChatId;
        await prisma.telegramBinding.upsert({
          where: { phone: normalizedPhone },
          update: { chatId: telegramChatId },
          create: { phone: normalizedPhone, chatId: telegramChatId },
        });
      } else {
        const existingBinding = await prisma.telegramBinding.findUnique({
          where: { phone: normalizedPhone },
        });
        resolvedTelegramChatId = existingBinding?.chatId || undefined;
      }

      if (!resolvedTelegramChatId) {
        return res.status(400).json({
          error: 'Для Telegram-входа укажите Telegram chat id (один раз), затем код будет приходить автоматически.',
        });
      }
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);
    const provider = await sendVerificationCode(normalizedPhone, code, {
      telegramChatId: resolvedTelegramChatId,
    });

    await prisma.phoneVerification.upsert({
      where: { phone: normalizedPhone },
      update: {
        codeHash: hashCode(code),
        expiresAt,
        attempts: 0,
      },
      create: {
        phone: normalizedPhone,
        codeHash: hashCode(code),
        expiresAt,
      },
    });

    const response: {
      message: string;
      expiresInSeconds: number;
      provider: 'twilio' | 'textbelt' | 'telegram' | 'mock';
      debugCode?: string;
    } = {
      message: 'Код отправлен',
      expiresInSeconds: Math.floor(OTP_TTL_MS / 1000),
      provider,
    };

    if (provider === 'mock' && process.env.NODE_ENV !== 'production') {
      response.debugCode = code;
    }

    res.json(response);
  } catch (error) {
    console.error('Failed to send verification code:', error);
    res.status(500).json({ error: 'Не удалось отправить код. Попробуйте позже.' });
  }
});

authRouter.post('/verify-code', async (req, res) => {
  try {
    const normalizedPhone = normalizePhoneNumber(req.body?.phone || '');
    const code = String(req.body?.code || '').trim();
    const inputName = String(req.body?.displayName || '').trim();

    if (!isValidPhoneNumber(normalizedPhone)) {
      return res.status(400).json({
        error: 'Введите номер в международном формате, например +79991234567',
      });
    }

    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: 'Код должен содержать 6 цифр' });
    }

    const verification = await prisma.phoneVerification.findUnique({
      where: { phone: normalizedPhone },
    });

    if (!verification) {
      return res.status(400).json({ error: 'Сначала запросите код' });
    }

    const now = Date.now();
    if (verification.expiresAt.getTime() < now) {
      await prisma.phoneVerification.delete({ where: { phone: normalizedPhone } });
      return res.status(400).json({ error: 'Срок действия кода истек' });
    }

    if (verification.attempts >= OTP_MAX_ATTEMPTS) {
      await prisma.phoneVerification.delete({ where: { phone: normalizedPhone } });
      return res.status(429).json({ error: 'Слишком много попыток. Запросите новый код.' });
    }

    const providedCodeHash = hashCode(code);
    if (providedCodeHash !== verification.codeHash) {
      const nextAttempts = verification.attempts + 1;
      await prisma.phoneVerification.update({
        where: { phone: normalizedPhone },
        data: { attempts: nextAttempts },
      });

      return res.status(400).json({
        error: 'Неверный код',
        attemptsLeft: Math.max(OTP_MAX_ATTEMPTS - nextAttempts, 0),
      });
    }

    await prisma.phoneVerification.delete({ where: { phone: normalizedPhone } });

    let user = await prisma.user.findUnique({
      where: { phone: normalizedPhone },
    });

    let isNewUser = false;
    if (!user) {
      isNewUser = true;
      const displayName = inputName.length > 0
        ? inputName.slice(0, 40)
        : `User ${normalizedPhone.slice(-4)}`;

      const generatedPassword = randomBytes(24).toString('hex');
      const hashedPassword = await bcrypt.hash(generatedPassword, 10);

      user = await prisma.user.create({
        data: {
          phone: normalizedPhone,
          password: hashedPassword,
          displayName,
          settings: {
            create: {},
          },
        },
      });
    }

    res.json({
      user: toAuthUser(user),
      token: signToken(user.id),
      isNewUser,
    });
  } catch (error) {
    console.error('Failed to verify code:', error);
    res.status(500).json({ error: 'Ошибка подтверждения кода' });
  }
});

authRouter.post('/register', async (req, res) => {
  try {
    const phone = normalizePhoneNumber(req.body?.phone || '');
    const { password, displayName } = req.body;

    if (!phone || !password || !displayName) {
      return res.status(400).json({ error: 'Все поля обязательны' });
    }

    if (!isValidPhoneNumber(phone)) {
      return res.status(400).json({
        error: 'Введите номер в международном формате, например +79991234567',
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: { phone },
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Пользователь с таким номером уже существует' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        phone,
        password: hashedPassword,
        displayName,
        settings: {
          create: {},
        },
      },
    });

    res.json({
      user: toAuthUser(user),
      token: signToken(user.id),
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Ошибка регистрации' });
  }
});

authRouter.post('/login', async (req, res) => {
  try {
    const phone = normalizePhoneNumber(req.body?.phone || '');
    const { password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ error: 'Все поля обязательны' });
    }

    const user = await prisma.user.findUnique({
      where: { phone },
    });

    if (!user) {
      return res.status(401).json({ error: 'Неверный номер или пароль' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Неверный номер или пароль' });
    }

    res.json({
      user: toAuthUser(user),
      token: signToken(user.id),
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Ошибка входа' });
  }
});

authRouter.post('/logout', async (req, res) => {
  res.json({ message: 'Выход выполнен' });
});
