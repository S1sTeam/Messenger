import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db.js';
import bcrypt from 'bcrypt';

export const settingsRouter = Router();

// Получить настройки пользователя
settingsRouter.get('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        settings: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    res.json({
      user: {
        id: user.id,
        phone: user.phone,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
        bio: user.bio
      },
      settings: user.settings || {
        notifications: true,
        notificationSound: true,
        darkMode: true,
        fontSize: 'medium',
        language: 'ru',
        twoFactorAuth: false
      }
    });
  } catch (error) {
    console.error('❌ Settings loading error:', error);
    res.status(500).json({ error: 'Ошибка загрузки настроек' });
  }
});

// Обновить профиль
settingsRouter.patch('/profile', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { username, displayName, bio } = req.body;

    // Проверяем уникальность username если он изменился
    if (username) {
      const existingUser = await prisma.user.findFirst({
        where: {
          username,
          NOT: {
            id: userId
          }
        }
      });

      if (existingUser) {
        return res.status(400).json({ error: 'Это имя пользователя уже занято' });
      }
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        username: username || undefined,
        displayName: displayName || undefined,
        bio: bio !== undefined ? bio : undefined
      }
    });

    res.json({
      user: {
        id: user.id,
        phone: user.phone,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
        bio: user.bio
      }
    });
  } catch (error) {
    console.error('❌ Profile update error:', error);
    res.status(500).json({ error: 'Ошибка обновления профиля' });
  }
});

// Изменить пароль
settingsRouter.post('/password', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Все поля обязательны' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const isValidPassword = await bcrypt.compare(currentPassword, user.password);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Неверный текущий пароль' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });

    res.json({ message: 'Пароль успешно изменен' });
  } catch (error) {
    console.error('❌ Password change error:', error);
    res.status(500).json({ error: 'Ошибка изменения пароля' });
  }
});

// Обновить настройки
settingsRouter.patch('/preferences', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { notifications, notificationSound, darkMode, fontSize, language, twoFactorAuth } = req.body;

    const settings = await prisma.userSettings.upsert({
      where: { userId },
      update: {
        notifications: notifications !== undefined ? notifications : undefined,
        notificationSound: notificationSound !== undefined ? notificationSound : undefined,
        darkMode: darkMode !== undefined ? darkMode : undefined,
        fontSize: fontSize || undefined,
        language: language || undefined,
        twoFactorAuth: twoFactorAuth !== undefined ? twoFactorAuth : undefined
      },
      create: {
        userId,
        notifications: notifications ?? true,
        notificationSound: notificationSound ?? true,
        darkMode: darkMode ?? true,
        fontSize: fontSize || 'medium',
        language: language || 'ru',
        twoFactorAuth: twoFactorAuth ?? false
      }
    });

    res.json({ settings });
  } catch (error) {
    console.error('❌ Settings update error:', error);
    res.status(500).json({ error: 'Ошибка обновления настроек' });
  }
});

// Обновить аватар
settingsRouter.patch('/avatar', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { avatar } = req.body;

    if (!avatar) {
      return res.status(400).json({ error: 'URL аватара обязателен' });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { avatar }
    });

    res.json({
      user: {
        id: user.id,
        phone: user.phone,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
        bio: user.bio
      }
    });
  } catch (error) {
    console.error('❌ Avatar update error:', error);
    res.status(500).json({ error: 'Ошибка обновления аватара' });
  }
});
