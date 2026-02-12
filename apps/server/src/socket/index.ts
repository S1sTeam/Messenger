import { Server } from 'socket.io';
import { prisma } from '../db.js';

const onlineUsers = new Map<string, Set<string>>();
const lastSeenByUser = new Map<string, string>();
const lastActivityByUser = new Map<string, number>();

const debug = (...args: unknown[]) => {
  if (process.env.SOCKET_DEBUG === 'true') {
    console.log('[socket]', ...args);
  }
};

const normalizeString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const getOnlineUserIds = () => Array.from(onlineUsers.keys());

const getLastSeenSnapshot = () => {
  const snapshot: Record<string, string> = {};
  for (const [userId, lastSeenAt] of lastSeenByUser.entries()) {
    snapshot[userId] = lastSeenAt;
  }
  return snapshot;
};

const addOnlineSocket = (userId: string, socketId: string) => {
  const socketIds = onlineUsers.get(userId) ?? new Set<string>();
  const wasOffline = socketIds.size === 0;

  socketIds.add(socketId);
  onlineUsers.set(userId, socketIds);

  return wasOffline;
};

const removeOnlineSocket = (userId: string, socketId: string) => {
  const socketIds = onlineUsers.get(userId);
  if (!socketIds) {
    return false;
  }

  socketIds.delete(socketId);
  if (socketIds.size === 0) {
    onlineUsers.delete(userId);
    return true;
  }

  onlineUsers.set(userId, socketIds);
  return false;
};

const isUserOnline = (userId: string) => {
  const socketIds = onlineUsers.get(userId);
  return !!socketIds && socketIds.size > 0;
};

interface MissedCallParams {
  callerId: string;
  recipientId: string;
  chatId?: string;
  callType: 'audio' | 'video';
  text: string;
}

interface MessageSendPayload {
  chatId?: string;
  content?: string;
  clientMessageId?: string;
}

interface MarkReadPayload {
  chatId?: string;
  messageIds?: string[];
}

interface CallInitiatePayload {
  recipientId?: string;
  chatId?: string;
  callType?: 'audio' | 'video';
  callerName?: string;
}

interface CallRejectPayload {
  callerId?: string;
  chatId?: string;
  callType?: 'audio' | 'video';
}

interface CallMissedPayload {
  recipientId?: string;
  chatId?: string;
  callType?: 'audio' | 'video';
}

interface CallEndPayload {
  recipientId?: string;
}

interface WebRtcOfferPayload {
  recipientId?: string;
  offer: RTCSessionDescriptionInit;
  callType?: 'audio' | 'video';
}

interface WebRtcAnswerPayload {
  recipientId?: string;
  answer: RTCSessionDescriptionInit;
}

interface WebRtcCandidatePayload {
  recipientId?: string;
  candidate: RTCIceCandidateInit;
}

interface CallAnswerPayload {
  callerId?: string;
}

export const setupSocketHandlers = (io: Server) => {
  io.on('connection', (socket) => {
    const userId = normalizeString(socket.handshake.query.userId);

    const touchActivity = () => {
      if (!userId) {
        return;
      }
      lastActivityByUser.set(userId, Date.now());
    };

    const emitPresenceSnapshot = () => {
      socket.emit('users:online', getOnlineUserIds());
      socket.emit('users:lastSeen', getLastSeenSnapshot());
    };

    debug('User connected', { socketId: socket.id, userId });

    const resolvePrivateChatId = async (
      callerId: string,
      recipientId: string,
      preferredChatId?: string,
    ): Promise<string | null> => {
      if (preferredChatId) {
        const directChat = await prisma.chat.findFirst({
          where: {
            id: preferredChatId,
            type: 'private',
            AND: [
              {
                participants: {
                  some: { userId: callerId },
                },
              },
              {
                participants: {
                  some: { userId: recipientId },
                },
              },
            ],
          },
          select: { id: true },
        });

        if (directChat?.id) {
          return directChat.id;
        }
      }

      const fallbackChat = await prisma.chat.findFirst({
        where: {
          type: 'private',
          AND: [
            {
              participants: {
                some: { userId: callerId },
              },
            },
            {
              participants: {
                some: { userId: recipientId },
              },
            },
          ],
        },
        select: { id: true },
      });

      return fallbackChat?.id ?? null;
    };

    const persistMissedCallWithMessage = async (params: MissedCallParams) => {
      const { callerId, recipientId, chatId, callType, text } = params;

      await prisma.missedCall.create({
        data: {
          callerId,
          recipientId,
          callType,
        },
      });

      const targetChatId = await resolvePrivateChatId(callerId, recipientId, chatId);
      if (!targetChatId) {
        return false;
      }

      const savedMessage = await prisma.message.create({
        data: {
          chatId: targetChatId,
          senderId: callerId,
          content: text,
          type: 'text',
        },
        include: {
          sender: {
            select: {
              id: true,
              displayName: true,
              avatar: true,
            },
          },
        },
      });

      void prisma.chat
        .update({
          where: { id: targetChatId },
          data: { updatedAt: new Date() },
        })
        .catch((error) => {
          console.error('Failed to bump chat updatedAt:', error);
        });

      const fullMessage = {
        id: savedMessage.id,
        chatId: savedMessage.chatId,
        senderId: savedMessage.senderId,
        senderName: savedMessage.sender.displayName,
        senderAvatar: savedMessage.sender.avatar || '👤',
        content: savedMessage.content,
        createdAt: savedMessage.createdAt,
        isRead: savedMessage.isRead,
      };

      io.to(`user:${callerId}`).emit('message:sent', fullMessage);
      io.to(`user:${recipientId}`).emit('message:receive', fullMessage);

      return true;
    };

    if (userId) {
      socket.join(`user:${userId}`);

      const becameOnline = addOnlineSocket(userId, socket.id);
      lastSeenByUser.delete(userId);
      touchActivity();
      emitPresenceSnapshot();

      if (becameOnline) {
        io.emit('user:online', { userId, onlineAt: new Date().toISOString() });
      }
    }

    socket.on('presence:ping', () => {
      touchActivity();
    });

    socket.on('users:getOnline', () => {
      emitPresenceSnapshot();
    });

    socket.on('message:send', async (payload: MessageSendPayload) => {
      try {
        if (!userId) {
          socket.emit('message:error', { error: 'Пользователь не авторизован' });
          return;
        }

        touchActivity();

        const chatId = normalizeString(payload.chatId);
        const content = normalizeString(payload.content);
        const clientMessageId = normalizeString(payload.clientMessageId);

        if (!chatId) {
          socket.emit('message:error', { error: 'Чат не найден' });
          return;
        }

        if (!content) {
          socket.emit('message:error', { error: 'Пустое сообщение' });
          return;
        }

        const membership = await prisma.chatParticipant.findFirst({
          where: {
            chatId,
            userId,
          },
          select: { id: true },
        });

        if (!membership) {
          socket.emit('message:error', { error: 'Нет доступа к этому чату' });
          return;
        }

        const savedMessage = await prisma.message.create({
          data: {
            chatId,
            senderId: userId,
            content,
            type: 'text',
          },
          include: {
            sender: {
              select: {
                id: true,
                displayName: true,
                avatar: true,
              },
            },
          },
        });

        const participants = await prisma.chatParticipant.findMany({
          where: { chatId },
          select: { userId: true },
        });

        void prisma.chat
          .update({
            where: { id: chatId },
            data: { updatedAt: new Date() },
          })
          .catch((error) => {
            console.error('Failed to bump chat updatedAt:', error);
          });

        const fullMessage = {
          id: savedMessage.id,
          clientMessageId,
          chatId: savedMessage.chatId,
          senderId: savedMessage.senderId,
          senderName: savedMessage.sender.displayName,
          senderAvatar: savedMessage.sender.avatar || '👤',
          content: savedMessage.content,
          createdAt: savedMessage.createdAt,
          isRead: savedMessage.isRead,
        };

        for (const participant of participants) {
          if (participant.userId === userId) {
            continue;
          }
          io.to(`user:${participant.userId}`).emit('message:receive', fullMessage);
        }

        socket.emit('message:sent', fullMessage);
      } catch (error) {
        console.error('Error saving message:', error);
        socket.emit('message:error', { error: 'Ошибка отправки сообщения' });
      }
    });

    socket.on('messages:markRead', async (payload: MarkReadPayload) => {
      try {
        if (!userId) {
          return;
        }

        touchActivity();

        const chatId = normalizeString(payload.chatId);
        const messageIds = Array.isArray(payload.messageIds) ? payload.messageIds.filter((id) => typeof id === 'string') : [];

        if (!chatId || messageIds.length === 0) {
          return;
        }

        await prisma.message.updateMany({
          where: {
            id: { in: messageIds },
            chatId,
          },
          data: {
            isRead: true,
          },
        });

        socket.to(chatId).emit('messages:read', { chatId, messageIds });
      } catch (error) {
        console.error('Error marking messages as read:', error);
      }
    });

    socket.on('call:initiate', async (payload: CallInitiatePayload) => {
      if (!userId) {
        return;
      }

      touchActivity();

      const recipientId = normalizeString(payload.recipientId);
      if (!recipientId) {
        return;
      }

      const normalizedCallType = payload.callType === 'video' ? 'video' : 'audio';

      if (isUserOnline(recipientId)) {
        io.to(`user:${recipientId}`).emit('call:incoming', {
          callerId: userId,
          callerName: payload.callerName,
          chatId: payload.chatId,
          callType: normalizedCallType,
          socketId: socket.id,
        });
        return;
      }

      try {
        const missedCallSavedToChat = await persistMissedCallWithMessage({
          callerId: userId,
          recipientId,
          chatId: payload.chatId,
          callType: normalizedCallType,
          text: normalizedCallType === 'video' ? 'Пропущенный видеозвонок' : 'Пропущенный аудиозвонок',
        });

        socket.emit('call:offline', {
          reason: missedCallSavedToChat
            ? 'Пользователь не в сети. Пропущенный звонок добавлен в чат.'
            : 'Пользователь не в сети.',
        });
      } catch (error) {
        console.error('Error saving missed call:', error);
      }
    });

    socket.on('webrtc:offer', (payload: WebRtcOfferPayload) => {
      touchActivity();

      const recipientId = normalizeString(payload.recipientId);
      if (!recipientId) {
        return;
      }

      io.to(`user:${recipientId}`).emit('webrtc:offer', {
        senderId: userId,
        offer: payload.offer,
        callType: payload.callType,
      });
    });

    socket.on('webrtc:answer', (payload: WebRtcAnswerPayload) => {
      touchActivity();

      const recipientId = normalizeString(payload.recipientId);
      if (!recipientId) {
        return;
      }

      io.to(`user:${recipientId}`).emit('webrtc:answer', {
        senderId: userId,
        answer: payload.answer,
      });
    });

    socket.on('webrtc:ice-candidate', (payload: WebRtcCandidatePayload) => {
      touchActivity();

      const recipientId = normalizeString(payload.recipientId);
      if (!recipientId) {
        return;
      }

      io.to(`user:${recipientId}`).emit('webrtc:ice-candidate', {
        senderId: userId,
        candidate: payload.candidate,
      });
    });

    socket.on('call:answer', (payload: CallAnswerPayload) => {
      touchActivity();

      const callerId = normalizeString(payload.callerId);
      if (!callerId) {
        return;
      }

      io.to(`user:${callerId}`).emit('call:answered', { userId });
    });

    socket.on('call:reject', async (payload: CallRejectPayload) => {
      touchActivity();

      const callerId = normalizeString(payload.callerId);
      if (!callerId) {
        return;
      }

      io.to(`user:${callerId}`).emit('call:rejected', { userId });

      if (!userId) {
        return;
      }

      try {
        const normalizedCallType = payload.callType === 'video' ? 'video' : 'audio';
        await persistMissedCallWithMessage({
          callerId,
          recipientId: userId,
          chatId: payload.chatId,
          callType: normalizedCallType,
          text: normalizedCallType === 'video' ? 'Пропущенный видеозвонок' : 'Пропущенный аудиозвонок',
        });
      } catch (error) {
        console.error('Error saving rejected call:', error);
      }
    });

    socket.on('call:missed', async (payload: CallMissedPayload) => {
      touchActivity();

      if (!userId) {
        return;
      }

      const recipientId = normalizeString(payload.recipientId);
      if (!recipientId) {
        return;
      }

      const normalizedCallType = payload.callType === 'video' ? 'video' : 'audio';

      try {
        await persistMissedCallWithMessage({
          callerId: userId,
          recipientId,
          chatId: payload.chatId,
          callType: normalizedCallType,
          text: normalizedCallType === 'video' ? 'Пропущенный видеозвонок' : 'Пропущенный аудиозвонок',
        });
      } catch (error) {
        console.error('Error saving missed call:', error);
      }
    });

    socket.on('call:end', (payload: CallEndPayload) => {
      touchActivity();

      const recipientId = normalizeString(payload.recipientId);
      if (!recipientId) {
        return;
      }

      io.to(`user:${recipientId}`).emit('call:ended', { userId });
    });

    socket.on('user:typing', (chatId: string) => {
      touchActivity();

      if (typeof chatId !== 'string' || !chatId) {
        return;
      }

      socket.to(chatId).emit('user:typing', chatId);
    });

    socket.on('chat:join', (chatId: string) => {
      if (typeof chatId !== 'string' || !chatId) {
        return;
      }

      socket.join(chatId);
    });

    socket.on('disconnect', () => {
      if (!userId) {
        return;
      }

      const becameOffline = removeOnlineSocket(userId, socket.id);
      if (!becameOffline) {
        return;
      }

      const lastSeenAt = new Date(lastActivityByUser.get(userId) ?? Date.now()).toISOString();
      lastSeenByUser.set(userId, lastSeenAt);
      lastActivityByUser.delete(userId);

      io.emit('user:offline', { userId, lastSeenAt });
      debug('User disconnected', { socketId: socket.id, userId, lastSeenAt });
    });
  });
};