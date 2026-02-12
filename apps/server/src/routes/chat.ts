import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db.js';

export const chatRouter = Router();

chatRouter.get('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    const chats = await prisma.chat.findMany({
      where: {
        participants: {
          some: {
            userId
          }
        }
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                username: true,
                avatar: true
              }
            }
          }
        },
        messages: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 1,
          include: {
            sender: {
              select: {
                displayName: true
              }
            }
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    const chatsFormatted = chats.map(chat => {
      const otherParticipant = chat.participants.find(p => p.userId !== userId)?.user;
      const currentUserParticipant = chat.participants.find(p => p.userId === userId);
      const lastMessage = chat.messages[0];
      
      return {
        id: chat.id,
        name: chat.type === 'group' ? chat.name : otherParticipant?.displayName || 'Неизвестный',
        avatar: chat.avatar || otherParticipant?.avatar || '👤',
        lastMessage: lastMessage?.content || '',
        lastMessageTime: lastMessage ? new Date(lastMessage.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '',
        unread: 0,
        participants: chat.participants.map(p => p.userId),
        isPinned: currentUserParticipant?.isPinned || false,
        isArchived: currentUserParticipant?.isArchived || false,
        isMuted: currentUserParticipant?.isMuted || false
      };
    });

    res.json({ chats: chatsFormatted });
  } catch (error) {
    console.error('❌ Chats loading error:', error);
    res.status(500).json({ error: 'Ошибка загрузки чатов' });
  }
});

chatRouter.get('/:chatId/messages', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.userId!;

    // Проверяем, что пользователь участник чата
    const participant = await prisma.chatParticipant.findFirst({
      where: {
        chatId,
        userId
      }
    });

    if (!participant) {
      return res.status(403).json({ error: 'Нет доступа к чату' });
    }

    const messages = await prisma.message.findMany({
      where: { chatId },
      include: {
        sender: {
          select: {
            id: true,
            displayName: true,
            avatar: true
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    const messagesFormatted = messages.map(msg => ({
      id: msg.id,
      chatId: msg.chatId,
      senderId: msg.senderId,
      senderName: msg.sender.displayName,
      senderAvatar: msg.sender.avatar || '👤',
      content: msg.content,
      createdAt: msg.createdAt,
      isRead: msg.isRead
    }));

    res.json({ messages: messagesFormatted });
  } catch (error) {
    console.error('❌ Messages loading error:', error);
    res.status(500).json({ error: 'Ошибка загрузки сообщений' });
  }
});

chatRouter.post('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { userId: otherUserId } = req.body;
    const userId = req.userId!;

    if (!otherUserId) {
      return res.status(400).json({ error: 'userId обязателен' });
    }

    // Проверяем, существует ли пользователь
    const otherUser = await prisma.user.findUnique({
      where: { id: otherUserId }
    });

    if (!otherUser) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Проверяем, существует ли уже чат между этими пользователями
    const existingChats = await prisma.chat.findMany({
      where: {
        type: 'private',
        participants: {
          some: {
            userId: userId
          }
        }
      },
      include: {
        participants: true
      }
    });

    // Ищем чат, где оба пользователя участники
    const existingChat = existingChats.find(chat => {
      const participantIds = chat.participants.map(p => p.userId);
      return participantIds.includes(userId) && participantIds.includes(otherUserId) && participantIds.length === 2;
    });

    if (existingChat) {
      const otherParticipant = existingChat.participants.find(p => p.userId !== userId);
      const otherUserData = await prisma.user.findUnique({
        where: { id: otherParticipant!.userId },
        select: {
          id: true,
          displayName: true,
          avatar: true
        }
      });

      return res.json({
        chat: {
          id: existingChat.id,
          name: otherUserData?.displayName || 'Чат',
          avatar: otherUserData?.avatar || '👤',
          lastMessage: '',
          lastMessageTime: '',
          unread: 0,
          participants: existingChat.participants.map(p => p.userId)
        }
      });
    }

    const chat = await prisma.chat.create({
      data: {
        type: 'private',
        participants: {
          create: [
            { userId },
            { userId: otherUserId }
          ]
        }
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                avatar: true
              }
            }
          }
        }
      }
    });

    const otherParticipant = chat.participants.find(p => p.userId !== userId)?.user;

    res.json({
      chat: {
        id: chat.id,
        name: otherParticipant?.displayName || 'Новый чат',
        avatar: otherParticipant?.avatar || '👤',
        lastMessage: '',
        lastMessageTime: '',
        unread: 0,
        participants: chat.participants.map(p => p.userId)
      }
    });
  } catch (error) {
    console.error('❌ Chat creation error:', error);
    res.status(500).json({ error: 'Ошибка создания чата' });
  }
});

chatRouter.post('/:chatId/messages', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { chatId } = req.params;
    const { content } = req.body;
    const userId = req.userId!;

    // Проверяем, что пользователь участник чата
    const participant = await prisma.chatParticipant.findFirst({
      where: {
        chatId,
        userId
      }
    });

    if (!participant) {
      return res.status(403).json({ error: 'Нет доступа к чату' });
    }

    const message = await prisma.message.create({
      data: {
        chatId,
        senderId: userId,
        content,
        type: 'text'
      },
      include: {
        sender: {
          select: {
            id: true,
            displayName: true,
            avatar: true
          }
        }
      }
    });

    // Обновляем время последнего обновления чата
    await prisma.chat.update({
      where: { id: chatId },
      data: { updatedAt: new Date() }
    });

    res.json({
      message: {
        id: message.id,
        chatId: message.chatId,
        senderId: message.senderId,
        senderName: message.sender.displayName,
        senderAvatar: message.sender.avatar || '👤',
        content: message.content,
        createdAt: message.createdAt,
        isRead: message.isRead
      }
    });
  } catch (error) {
    console.error('❌ Message sending error:', error);
    res.status(500).json({ error: 'Ошибка отправки сообщения' });
  }
});

// Удаление чата
chatRouter.delete('/:chatId', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.userId!;

    // Проверяем, что пользователь участник чата
    const participant = await prisma.chatParticipant.findFirst({
      where: {
        chatId,
        userId
      }
    });

    if (!participant) {
      return res.status(403).json({ error: 'Нет доступа к чату' });
    }

    // Удаляем все сообщения чата
    await prisma.message.deleteMany({
      where: { chatId }
    });

    // Удаляем всех участников
    await prisma.chatParticipant.deleteMany({
      where: { chatId }
    });

    // Удаляем сам чат
    await prisma.chat.delete({
      where: { id: chatId }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Chat deletion error:', error);
    res.status(500).json({ error: 'Ошибка удаления чата' });
  }
});

// Закрепление/открепление чата
chatRouter.patch('/:chatId/pin', authMiddleware, async (req: AuthRequest, res) => {
  try {
    console.log('📌 Pin request received:', req.params.chatId, req.body);
    const { chatId } = req.params;
    const userId = req.userId!;
    const { isPinned } = req.body;

    const participant = await prisma.chatParticipant.findFirst({
      where: { chatId, userId }
    });

    if (!participant) {
      return res.status(403).json({ error: 'Нет доступа к чату' });
    }

    await prisma.chatParticipant.update({
      where: { id: participant.id },
      data: { isPinned }
    });

    console.log('✅ Chat pinned successfully');
    res.json({ success: true, isPinned });
  } catch (error) {
    console.error('❌ Pin chat error:', error);
    res.status(500).json({ error: 'Ошибка закрепления чата' });
  }
});

// Архивация/разархивация чата
chatRouter.patch('/:chatId/archive', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.userId!;
    const { isArchived } = req.body;

    const participant = await prisma.chatParticipant.findFirst({
      where: { chatId, userId }
    });

    if (!participant) {
      return res.status(403).json({ error: 'Нет доступа к чату' });
    }

    await prisma.chatParticipant.update({
      where: { id: participant.id },
      data: { isArchived }
    });

    res.json({ success: true, isArchived });
  } catch (error) {
    console.error('❌ Archive chat error:', error);
    res.status(500).json({ error: 'Ошибка архивации чата' });
  }
});

// Отключение/включение уведомлений
chatRouter.patch('/:chatId/mute', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.userId!;
    const { isMuted } = req.body;

    const participant = await prisma.chatParticipant.findFirst({
      where: { chatId, userId }
    });

    if (!participant) {
      return res.status(403).json({ error: 'Нет доступа к чату' });
    }

    await prisma.chatParticipant.update({
      where: { id: participant.id },
      data: { isMuted }
    });

    res.json({ success: true, isMuted });
  } catch (error) {
    console.error('❌ Mute chat error:', error);
    res.status(500).json({ error: 'Ошибка отключения уведомлений' });
  }
});
