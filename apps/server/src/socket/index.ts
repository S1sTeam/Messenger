import { Server } from 'socket.io';
import { prisma } from '../db.js';

// РҐСЂР°РЅРёР»РёС‰Рµ РѕРЅР»Р°Р№РЅ РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№
const onlineUsers = new Map<string, string>(); // userId -> socketId
const debug = (...args: unknown[]) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(...args);
  }
};

export const setupSocketHandlers = (io: Server) => {
  io.on('connection', (socket) => {
    debug('вњ… User connected:', socket.id);
    const userId = socket.handshake.query.userId as string;

    // Join user's personal room
    if (userId) {
      socket.join(`user:${userId}`);
      onlineUsers.set(userId, socket.id);
      
      // РћС‚РїСЂР°РІР»СЏРµРј РЅРѕРІРѕРјСѓ РїРѕР»СЊР·РѕРІР°С‚РµР»СЋ СЃРїРёСЃРѕРє РІСЃРµС… РѕРЅР»Р°Р№РЅ РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№
      const onlineUserIds = Array.from(onlineUsers.keys());
      socket.emit('users:online', onlineUserIds);
      debug('рџ“‹ Sent online users list to new user:', onlineUserIds.length, 'users');
      
      // РЈРІРµРґРѕРјР»СЏРµРј Р’РЎР•РҐ (РІРєР»СЋС‡Р°СЏ РЅРѕРІРѕРіРѕ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ) Рѕ С‚РѕРј, С‡С‚Рѕ СЌС‚РѕС‚ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ РѕРЅР»Р°Р№РЅ
      io.emit('user:online', { userId });
      debug('рџ‘¤ User online:', userId);
    }

    // РџРѕР»СѓС‡РёС‚СЊ СЃРїРёСЃРѕРє РѕРЅР»Р°Р№РЅ РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№ (РїРѕ Р·Р°РїСЂРѕСЃСѓ)
    socket.on('users:getOnline', () => {
      const onlineUserIds = Array.from(onlineUsers.keys());
      socket.emit('users:online', onlineUserIds);
      debug('рџ“‹ Sent online users list on request:', onlineUserIds.length, 'users');
    });

    const resolvePrivateChatId = async (callerId: string, recipientId: string, preferredChatId?: string): Promise<string | null> => {
      if (preferredChatId && preferredChatId.trim().length > 0) {
        const directChat = await prisma.chat.findFirst({
          where: {
            id: preferredChatId,
            type: 'private',
            AND: [
              {
                participants: {
                  some: { userId: callerId }
                }
              },
              {
                participants: {
                  some: { userId: recipientId }
                }
              }
            ]
          },
          select: { id: true }
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
                some: { userId: callerId }
              }
            },
            {
              participants: {
                some: { userId: recipientId }
              }
            }
          ]
        },
        select: { id: true }
      });

      return fallbackChat?.id || null;
    };

    const persistMissedCallWithMessage = async (params: {
      callerId: string;
      recipientId: string;
      chatId?: string;
      callType: 'audio' | 'video';
      text: string;
    }) => {
      const { callerId, recipientId, chatId, callType, text } = params;

      await prisma.missedCall.create({
        data: {
          callerId,
          recipientId,
          callType
        }
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

      void prisma.chat
        .update({
          where: { id: targetChatId },
          data: { updatedAt: new Date() }
        })
        .catch((error) => {
          console.error('Failed to bump chat updatedAt:', error);
        });

      const fullMessage = {
        id: savedMessage.id,
        chatId: savedMessage.chatId,
        senderId: savedMessage.senderId,
        senderName: savedMessage.sender.displayName,
        senderAvatar: savedMessage.sender.avatar || 'рџ‘¤',
        content: savedMessage.content,
        createdAt: savedMessage.createdAt,
        isRead: savedMessage.isRead
      };

      io.to(`user:${callerId}`).emit('message:sent', fullMessage);
      io.to(`user:${recipientId}`).emit('message:receive', fullMessage);

      return true;
    };

    socket.on('message:send', async (message) => {
      debug('рџ“Ё Message sent by user:', userId, 'to chat:', message.chatId);
      
      try {
        // РЎРѕС…СЂР°РЅСЏРµРј СЃРѕРѕР±С‰РµРЅРёРµ РІ Р‘Р”
        const savedMessage = await prisma.message.create({
          data: {
            chatId: message.chatId,
            senderId: userId || 'unknown',
            content: message.content,
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

        // РћР±РЅРѕРІР»СЏРµРј РІСЂРµРјСЏ РїРѕСЃР»РµРґРЅРµРіРѕ РѕР±РЅРѕРІР»РµРЅРёСЏ С‡Р°С‚Р°
        void prisma.chat
        .update({
          where: { id: message.chatId },
          data: { updatedAt: new Date() }
        })
        .catch((error) => {
          console.error('Failed to bump chat updatedAt:', error);
        });

        const fullMessage = {
          id: savedMessage.id,
          chatId: savedMessage.chatId,
          senderId: savedMessage.senderId,
          senderName: savedMessage.sender.displayName,
          senderAvatar: savedMessage.sender.avatar || 'рџ‘¤',
          content: savedMessage.content,
          createdAt: savedMessage.createdAt,
          isRead: savedMessage.isRead
        };

        // РћС‚РїСЂР°РІР»СЏРµРј РўРћР›Р¬РљРћ РґСЂСѓРіРёРј СѓС‡Р°СЃС‚РЅРёРєР°Рј С‡Р°С‚Р° (РЅРµ РѕС‚РїСЂР°РІРёС‚РµР»СЋ)
        socket.to(message.chatId).emit('message:receive', fullMessage);
        
        // РћС‚РїСЂР°РІРёС‚РµР»СЋ РѕС‚РїСЂР°РІР»СЏРµРј РїРѕРґС‚РІРµСЂР¶РґРµРЅРёРµ СЃ С‚РµРј Р¶Рµ СЃРѕРѕР±С‰РµРЅРёРµРј
        socket.emit('message:sent', fullMessage);
        
        debug('вњ… Message saved and sent to chat:', message.chatId);
      } catch (error) {
        console.error('вќЊ Error saving message:', error);
        socket.emit('message:error', { error: 'РћС€РёР±РєР° РѕС‚РїСЂР°РІРєРё СЃРѕРѕР±С‰РµРЅРёСЏ' });
      }
    });

    // РћС‚РјРµС‚РєР° СЃРѕРѕР±С‰РµРЅРёР№ РєР°Рє РїСЂРѕС‡РёС‚Р°РЅРЅС‹С…
    socket.on('messages:markRead', async ({ chatId, messageIds }) => {
      debug('вњ… Marking messages as read in chat:', chatId);
      
      try {
        await prisma.message.updateMany({
          where: {
            id: { in: messageIds },
            chatId: chatId
          },
          data: {
            isRead: true
          }
        });

        // РЈРІРµРґРѕРјР»СЏРµРј РѕС‚РїСЂР°РІРёС‚РµР»РµР№ С‡С‚Рѕ СЃРѕРѕР±С‰РµРЅРёСЏ РїСЂРѕС‡РёС‚Р°РЅС‹
        socket.to(chatId).emit('messages:read', { chatId, messageIds });
        debug('вњ… Messages marked as read');
      } catch (error) {
        console.error('вќЊ Error marking messages as read:', error);
      }
    });

    // Р—РІРѕРЅРєРё
    socket.on('call:initiate', async ({ recipientId, chatId, callType, callerName }) => {
      if (!userId || !recipientId) {
        return;
      }

      const normalizedCallType = callType === 'video' ? 'video' : 'audio';
      debug('рџ“ћ Call initiated from', userId, 'to', recipientId);
      const recipientSocketId = onlineUsers.get(recipientId);
      
      if (recipientSocketId) {
        // РџРѕР»СѓС‡Р°С‚РµР»СЊ РѕРЅР»Р°Р№РЅ - РѕС‚РїСЂР°РІР»СЏРµРј Р·РІРѕРЅРѕРє
        io.to(`user:${recipientId}`).emit('call:incoming', {
          callerId: userId,
          callerName,
          chatId,
          callType: normalizedCallType,
          socketId: socket.id
        });
        debug('вњ… Call sent to recipient');
      } else {
        // РџРѕР»СѓС‡Р°С‚РµР»СЊ РѕС„С„Р»Р°Р№РЅ - СЃРѕС…СЂР°РЅСЏРµРј РїСЂРѕРїСѓС‰РµРЅРЅС‹Р№ РІС‹Р·РѕРІ
        try {
          const missedCallSavedToChat = await persistMissedCallWithMessage({
            callerId: userId,
            recipientId,
            chatId,
            callType: normalizedCallType,
            text: normalizedCallType === 'video' ? 'Пропущенный видеозвонок' : 'Пропущенный аудиозвонок',
          });

          debug('рџ“ќ Missed call saved');
          socket.emit('call:offline', {
            reason: missedCallSavedToChat
              ? 'Пользователь не в сети. Пропущенный звонок добавлен в чат.'
              : 'Пользователь не в сети.',
          });
        } catch (error) {
          console.error('вќЊ Error saving missed call:', error);
        }
      }
    });
    // WebRTC СЃРёРіРЅР°Р»РёРЅРі
    socket.on('webrtc:offer', ({ recipientId, offer, callType }) => {
      debug('рџ“Ў WebRTC offer from', userId, 'to', recipientId);
      io.to(`user:${recipientId}`).emit('webrtc:offer', {
        senderId: userId,
        offer,
        callType
      });
    });

    socket.on('webrtc:answer', ({ recipientId, answer }) => {
      debug('рџ“Ў WebRTC answer from', userId, 'to', recipientId);
      io.to(`user:${recipientId}`).emit('webrtc:answer', {
        senderId: userId,
        answer
      });
    });

    socket.on('webrtc:ice-candidate', ({ recipientId, candidate }) => {
      debug('рџ“Ў ICE candidate from', userId, 'to', recipientId);
      io.to(`user:${recipientId}`).emit('webrtc:ice-candidate', {
        senderId: userId,
        candidate
      });
    });

    socket.on('call:answer', ({ callerId }) => {
      debug('вњ… Call answered by', userId);
      io.to(`user:${callerId}`).emit('call:answered', { userId });
    });

    socket.on('call:reject', async ({ callerId, chatId, callType }) => {
      debug('вќЊ Call rejected by', userId);
      io.to(`user:${callerId}`).emit('call:rejected', { userId });

      if (!userId || !callerId) {
        return;
      }

      try {
        const normalizedCallType = callType === 'video' ? 'video' : 'audio';
        await persistMissedCallWithMessage({
          callerId,
          recipientId: userId,
          chatId,
          callType: normalizedCallType,
          text: normalizedCallType === 'video' ? 'Пропущенный видеозвонок' : 'Пропущенный аудиозвонок',
        });
      } catch (error) {
        console.error('вќЊ Error saving rejected call:', error);
      }
    });

    socket.on('call:missed', async ({ recipientId, chatId, callType }) => {
      if (!userId || !recipientId) {
        return;
      }

      const normalizedCallType = callType === 'video' ? 'video' : 'audio';

      try {
        await persistMissedCallWithMessage({
          callerId: userId,
          recipientId,
          chatId,
          callType: normalizedCallType,
          text: normalizedCallType === 'video' ? 'Пропущенный видеозвонок' : 'Пропущенный аудиозвонок',
        });
      } catch (error) {
        console.error('вќЊ Error saving missed (timeout) call:', error);
      }
    });

    socket.on('call:end', ({ recipientId }) => {
      debug('рџ“ґ Call ended by', userId);
      if (recipientId) {
        io.to(`user:${recipientId}`).emit('call:ended', { userId });
      }
    });

    socket.on('user:typing', (chatId) => {
      debug('вЊЁпёЏ User typing in chat:', chatId);
      socket.to(chatId).emit('user:typing', chatId);
    });

    socket.on('chat:join', (chatId) => {
      debug('рџљЄ User joined chat:', chatId);
      socket.join(chatId);
    });

    socket.on('disconnect', () => {
      debug('вќЊ User disconnected:', socket.id);
      
      if (userId) {
        onlineUsers.delete(userId);
        // РЈРІРµРґРѕРјР»СЏРµРј РІСЃРµС… Рѕ С‚РѕРј, С‡С‚Рѕ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ РѕС„С„Р»Р°Р№РЅ
        io.emit('user:offline', { userId });
        debug('рџ‘¤ User offline:', userId);
      }
    });
  });
};
