import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { createHash, randomBytes, randomInt } from 'crypto';
import { prisma } from '../db.js';
import {
  isValidEmail,
  normalizeEmail,
  sendVerificationCodeByEmail,
} from '../services/emailAuth.js';

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
  email: user.phone,
  phone: user.phone,
  username: user.username || undefined,
  displayName: user.displayName,
  avatar: user.avatar || undefined,
});

const resolveEmail = (payload: unknown): string => {
  const body = payload as Record<string, unknown> | undefined;
  const raw = String(body?.email || body?.phone || '');
  return normalizeEmail(raw);
};

authRouter.post('/send-code', async (req, res) => {
  try {
    const email = resolveEmail(req.body);
    if (!isValidEmail(email)) {
      return res.status(400).json({
        error: 'Введите корректный email, например user@gmail.com',
      });
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);
    const provider = await sendVerificationCodeByEmail(email, code);

    await prisma.phoneVerification.upsert({
      where: { phone: email },
      update: {
        codeHash: hashCode(code),
        expiresAt,
        attempts: 0,
      },
      create: {
        phone: email,
        codeHash: hashCode(code),
        expiresAt,
      },
    });

    const response: {
      message: string;
      expiresInSeconds: number;
      provider: 'gmail' | 'smtp' | 'mock';
      debugCode?: string;
    } = {
      message: 'Код отправлен на email',
      expiresInSeconds: Math.floor(OTP_TTL_MS / 1000),
      provider,
    };

    if (provider === 'mock' && process.env.NODE_ENV !== 'production') {
      response.debugCode = code;
    }

    res.json(response);
  } catch (error) {
    console.error('Failed to send verification code:', error);
    res.status(500).json({ error: 'Не удалось отправить код на email. Попробуйте позже.' });
  }
});

authRouter.post('/verify-code', async (req, res) => {
  try {
    const email = resolveEmail(req.body);
    const code = String(req.body?.code || '').trim();
    const inputName = String(req.body?.displayName || '').trim();

    if (!isValidEmail(email)) {
      return res.status(400).json({
        error: 'Введите корректный email, например user@gmail.com',
      });
    }

    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: 'Код должен содержать 6 цифр' });
    }

    const verification = await prisma.phoneVerification.findUnique({
      where: { phone: email },
    });

    if (!verification) {
      return res.status(400).json({ error: 'Сначала запросите код' });
    }

    const now = Date.now();
    if (verification.expiresAt.getTime() < now) {
      await prisma.phoneVerification.delete({ where: { phone: email } });
      return res.status(400).json({ error: 'Срок действия кода истек' });
    }

    if (verification.attempts >= OTP_MAX_ATTEMPTS) {
      await prisma.phoneVerification.delete({ where: { phone: email } });
      return res.status(429).json({ error: 'Слишком много попыток. Запросите новый код.' });
    }

    const providedCodeHash = hashCode(code);
    if (providedCodeHash !== verification.codeHash) {
      const nextAttempts = verification.attempts + 1;
      await prisma.phoneVerification.update({
        where: { phone: email },
        data: { attempts: nextAttempts },
      });

      return res.status(400).json({
        error: 'Неверный код',
        attemptsLeft: Math.max(OTP_MAX_ATTEMPTS - nextAttempts, 0),
      });
    }

    await prisma.phoneVerification.delete({ where: { phone: email } });

    let user = await prisma.user.findUnique({
      where: { phone: email },
    });

    let isNewUser = false;
    if (!user) {
      isNewUser = true;
      const displayName = inputName.length > 0
        ? inputName.slice(0, 40)
        : `User ${email.split('@')[0].slice(0, 12)}`;

      const generatedPassword = randomBytes(24).toString('hex');
      const hashedPassword = await bcrypt.hash(generatedPassword, 10);

      user = await prisma.user.create({
        data: {
          phone: email,
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
    const email = resolveEmail(req.body);
    const { password, displayName } = req.body;

    if (!email || !password || !displayName) {
      return res.status(400).json({ error: 'Все поля обязательны' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Введите корректный email' });
    }

    const existingUser = await prisma.user.findUnique({
      where: { phone: email },
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        phone: email,
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
    const email = resolveEmail(req.body);
    const { password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Все поля обязательны' });
    }

    const user = await prisma.user.findUnique({
      where: { phone: email },
    });

    if (!user) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
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
