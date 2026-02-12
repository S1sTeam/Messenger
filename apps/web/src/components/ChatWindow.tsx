import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Phone, Video, User, MessageSquare, Smile, Paperclip, Send, Sticker } from 'lucide-react';
import { Message } from './Message';
import { ChatMenu } from './ChatMenu';
import { CallModal } from './CallModal';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import styles from './ChatWindow.module.css';

interface ChatWindowProps {
  chatId: string;
  onChatDeleted?: () => void;
}

export const ChatWindow = ({ chatId, onChatDeleted }: ChatWindowProps) => {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [callType, setCallType] = useState<'audio' | 'video'>('audio');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const messages = useChatStore((state) => state.messages[chatId] || []);
  const chats = useChatStore((state) => state.chats);
  const sendMessage = useChatStore((state) => state.sendMessage);
  const loadMessages = useChatStore((state) => state.loadMessages);
  const setTyping = useChatStore((state) => state.setTyping);
  const isTyping = useChatStore((state) => state.isTyping[chatId]);
  const isUserOnline = useChatStore((state) => state.isUserOnline);
  const user = useAuthStore((state) => state.user);
  const socket = useChatStore((state) => state.socket);

  const chat = chats.find(c => c.id === chatId);
  
  // Определяем собеседника и его онлайн статус
  const otherUserId = chat?.participants.find(id => id !== user?.id);
  const isRecipientOnline = otherUserId ? isUserOnline(otherUserId) : false;

  useEffect(() => {
    if (chatId) {
      loadMessages(chatId);
      
      // Отмечаем все непрочитанные сообщения как прочитанные
      if (socket && messages.length > 0) {
        const unreadMessageIds = messages
          .filter(m => !m.isRead && m.senderId !== user?.id)
          .map(m => m.id);
        
        if (unreadMessageIds.length > 0) {
          socket.emit('messages:markRead', { chatId, messageIds: unreadMessageIds });
        }
      }
    }
  }, [chatId, messages.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (socket && chatId) {
      socket.emit('chat:join', chatId);
      
      // Слушаем когда сообщения прочитаны
      const handleMessagesRead = ({ messageIds }: { messageIds: string[] }) => {
        console.log('✅ Messages marked as read:', messageIds);
      };
      
      socket.on('messages:read', handleMessagesRead);
      
      return () => {
        socket.off('messages:read', handleMessagesRead);
      };
    }
  }, [socket, chatId, messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [chatId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isSending) return;
    
    setIsSending(true);
    try {
      await sendMessage(chatId, message);
      setMessage('');
      setShowEmojiPicker(false);
      setShowStickerPicker(false);
      inputRef.current?.focus();
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleTyping = () => {
    if (setTyping) {
      setTyping(chatId, true);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Проверка размера файла (макс 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('Файл слишком большой. Максимальный размер: 10MB');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('chatId', chatId);

      const authStorage = localStorage.getItem('auth-storage');
      if (!authStorage) return;
      
      const { state } = JSON.parse(authStorage);
      const token = state?.token;

      const response = await fetch('http://localhost:3000/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Ошибка загрузки файла');
      }

      const data = await response.json();
      
      // Отправляем сообщение с файлом
      const fileType = file.type.startsWith('image/') ? 'image' : 
                       file.type.startsWith('video/') ? 'video' : 'file';
      
      await sendMessage(chatId, `[${fileType}]${data.url}`);
      
      // Очищаем input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Ошибка загрузки файла:', error);
      alert('Не удалось загрузить файл');
    }
  };

  const emojis = ['😀', '😂', '❤️', '👍', '🔥', '🎉', '😍', '🤔', '👏', '🙌', '💯', '✨'];
  const stickers = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮'];

  return (
    <motion.div 
      className={styles.container}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <div className={styles.header}>
        <div className={styles.userInfo}>
          <div className={styles.avatar}>
            <User size={24} />
          </div>
          <div>
            <h3 className={styles.name}>{chat?.name || 'Чат'}</h3>
            <span className={`${styles.status} ${!isRecipientOnline && !isTyping ? styles.offline : ''}`}>
              {isTyping ? 'печатает...' : isRecipientOnline ? 'онлайн' : 'не в сети'}
            </span>
          </div>
        </div>
        
        <div className={styles.actions}>
          <button
            className={styles.actionBtn}
            onClick={() => {
              console.log('Аудио звонок нажат');
              if (socket && chat?.participants && chat.participants.length > 0) {
                const recipientId = chat.participants[0]; // participants это массив ID
                socket.emit('call:initiate', {
                  recipientId,
                  callType: 'audio',
                  callerName: user?.displayName || 'Пользователь'
                });
                setCallType('audio');
                setIsCallModalOpen(true);
              }
            }}
            title="Голосовой звонок"
          >
            <Phone size={20} />
          </button>
          
          <button
            className={styles.actionBtn}
            onClick={() => {
              console.log('Видео звонок нажат');
              if (socket && chat?.participants && chat.participants.length > 0) {
                const recipientId = chat.participants[0]; // participants это массив ID
                socket.emit('call:initiate', {
                  recipientId,
                  callType: 'video',
                  callerName: user?.displayName || 'Пользователь'
                });
                setCallType('video');
                setIsCallModalOpen(true);
              }
            }}
            title="Видеозвонок"
          >
            <Video size={20} />
          </button>
          
          <ChatMenu chatId={chatId} onDeleteChat={onChatDeleted} />
        </div>
      </div>

      <div className={styles.messages}>
        {messages.length === 0 ? (
          <div className={styles.emptyState}>
            <MessageSquare size={64} strokeWidth={1} />
            <p>Нет сообщений</p>
            <span>Начните диалог</span>
          </div>
        ) : (
          <>
            {messages.filter(msg => msg && msg.id && msg.content).map((msg, index) => (
              <Message
                key={msg.id}
                message={msg}
                isOwn={msg.senderId === user?.id}
                index={index}
              />
            ))}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className={styles.inputArea} onSubmit={handleSend}>
        <div className={styles.inputWrapper}>
          <div className={styles.attachments}>
            <button
              type="button"
              className={styles.attachBtn}
              onClick={() => fileInputRef.current?.click()}
              title="Прикрепить файл"
            >
              <Paperclip size={20} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />

            <button
              type="button"
              className={styles.attachBtn}
              onClick={() => {
                setShowEmojiPicker(!showEmojiPicker);
                setShowStickerPicker(false);
              }}
              title="Эмодзи"
            >
              <Smile size={20} />
            </button>

            <button
              type="button"
              className={styles.attachBtn}
              onClick={() => {
                setShowStickerPicker(!showStickerPicker);
                setShowEmojiPicker(false);
              }}
              title="Стикеры"
            >
              <Sticker size={20} />
            </button>
          </div>

          <input
            ref={inputRef}
            type="text"
            placeholder="Написать сообщение..."
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              handleTyping();
            }}
            onKeyPress={handleKeyPress}
            className={styles.input}
            disabled={isSending}
          />

          <button
            type="submit"
            className={styles.sendBtn}
            disabled={!message.trim() || isSending}
          >
            <Send size={20} />
          </button>
        </div>

        {showEmojiPicker && (
          <div className={styles.picker}>
            <div className={styles.pickerHeader}>Эмодзи</div>
            <div className={styles.pickerGrid}>
              {emojis.map((emoji, index) => (
                <button
                  key={index}
                  type="button"
                  className={styles.emojiBtn}
                  onClick={() => {
                    setMessage(message + emoji);
                    setShowEmojiPicker(false);
                    inputRef.current?.focus();
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        {showStickerPicker && (
          <div className={styles.picker}>
            <div className={styles.pickerHeader}>Стикеры</div>
            <div className={styles.pickerGrid}>
              {stickers.map((sticker, index) => (
                <button
                  key={index}
                  type="button"
                  className={styles.stickerBtn}
                  onClick={async () => {
                    await sendMessage(chatId, sticker);
                    setShowStickerPicker(false);
                  }}
                >
                  {sticker}
                </button>
              ))}
            </div>
          </div>
        )}
      </form>

      <CallModal
        isOpen={isCallModalOpen}
        callType={callType}
        recipientName={chat?.name || 'Пользователь'}
        recipientId={chatId}
        onClose={() => setIsCallModalOpen(false)}
      />
    </motion.div>
  );
};
