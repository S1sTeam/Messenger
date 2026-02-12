import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../db.js';

export const authRouter = Router();

authRouter.post('/register', async (req, res) => {
  try {
    console.log('📝 Register request:', req.body);
    const { phone, password, displayName } = req.body;

    if (!phone || !password || !displayName) {
      console.log('❌ Missing fields');
      return res.status(400).json({ error: 'Все поля обязательны' });
    }

    // Проверка формата телефона
    const phoneRegex = /^\+?[1-9]\d{10,14}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({ 
        error: 'Неверный формат номера телефона. Используйте международный формат, например: +79991234567' 
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: { phone }
    });

    if (existingUser) {
      console.log('❌ User already exists:', phone);
      return res.status(400).json({ error: 'Пользователь с таким номером уже существует' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const user = await prisma.user.create({
      data: {
        phone,
        password: hashedPassword,
        displayName,
        settings: {
          create: {}
        }
      }
    });

    console.log('✅ User registered:', phone, 'Total users:', await prisma.user.count());

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      user: {
        id: user.id,
        phone: user.phone,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
      },
      token,
    });
  } catch (error) {
    console.error('❌ Registration error:', error);
    res.status(500).json({ error: 'Ошибка регистрации' });
  }
});

authRouter.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ error: 'Все поля обязательны' });
    }

    const user = await prisma.user.findUnique({
      where: { phone }
    });

    if (!user) {
      return res.status(401).json({ error: 'Неверный номер или пароль' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Неверный номер или пароль' });
    }

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      user: {
        id: user.id,
        phone: user.phone,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
      },
      token,
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ error: 'Ошибка входа' });
  }
});

authRouter.post('/logout', async (req, res) => {
  res.json({ message: 'Выход выполнен' });
});
