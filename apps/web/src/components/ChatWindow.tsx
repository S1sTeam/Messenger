import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Phone, Video, User, MessageSquare, Smile, Paperclip, Send, Sticker } from 'lucide-react';
import { Message } from './Message';
import { ChatMenu } from './ChatMenu';
import { CallModal } from './CallModal';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import { toBackendUrl } from '../config/network';
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
  
  // РћРїСЂРµРґРµР»СЏРµРј СЃРѕР±РµСЃРµРґРЅРёРєР° Рё РµРіРѕ РѕРЅР»Р°Р№РЅ СЃС‚Р°С‚СѓСЃ
  const otherUserId = chat?.participants.find(id => id !== user?.id);
  const isRecipientOnline = otherUserId ? isUserOnline(otherUserId) : false;

  useEffect(() => {
    if (chatId) {
      loadMessages(chatId);
      
      // РћС‚РјРµС‡Р°РµРј РІСЃРµ РЅРµРїСЂРѕС‡РёС‚Р°РЅРЅС‹Рµ СЃРѕРѕР±С‰РµРЅРёСЏ РєР°Рє РїСЂРѕС‡РёС‚Р°РЅРЅС‹Рµ
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
      
      // РЎР»СѓС€Р°РµРј РєРѕРіРґР° СЃРѕРѕР±С‰РµРЅРёСЏ РїСЂРѕС‡РёС‚Р°РЅС‹
      const handleMessagesRead = ({ messageIds }: { messageIds: string[] }) => {
        console.log('вњ… Messages marked as read:', messageIds);
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

    // РџСЂРѕРІРµСЂРєР° СЂР°Р·РјРµСЂР° С„Р°Р№Р»Р° (РјР°РєСЃ 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('Р¤Р°Р№Р» СЃР»РёС€РєРѕРј Р±РѕР»СЊС€РѕР№. РњР°РєСЃРёРјР°Р»СЊРЅС‹Р№ СЂР°Р·РјРµСЂ: 10MB');
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

      const response = await fetch(toBackendUrl('/api/upload'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё С„Р°Р№Р»Р°');
      }

      const data = await response.json();
      
      // РћС‚РїСЂР°РІР»СЏРµРј СЃРѕРѕР±С‰РµРЅРёРµ СЃ С„Р°Р№Р»РѕРј
      const fileType = file.type.startsWith('image/') ? 'image' : 
                       file.type.startsWith('video/') ? 'video' : 'file';
      
      await sendMessage(chatId, `[${fileType}]${data.url}`);
      
      // РћС‡РёС‰Р°РµРј input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё С„Р°Р№Р»Р°:', error);
      alert('РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ С„Р°Р№Р»');
    }
  };

  const emojis = ['рџЂ', 'рџ‚', 'вќ¤пёЏ', 'рџ‘Ќ', 'рџ”Ґ', 'рџЋ‰', 'рџЌ', 'рџ¤”', 'рџ‘Џ', 'рџ™Њ', 'рџ’Ї', 'вњЁ'];
  const stickers = ['рџђ¶', 'рџђ±', 'рџђ­', 'рџђ№', 'рџђ°', 'рџ¦Љ', 'рџђ»', 'рџђј', 'рџђЁ', 'рџђЇ', 'рџ¦Ѓ', 'рџђ®'];

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
            <h3 className={styles.name}>{chat?.name || 'Р§Р°С‚'}</h3>
            <span className={`${styles.status} ${!isRecipientOnline && !isTyping ? styles.offline : ''}`}>
              {isTyping ? 'РїРµС‡Р°С‚Р°РµС‚...' : isRecipientOnline ? 'РѕРЅР»Р°Р№РЅ' : 'РЅРµ РІ СЃРµС‚Рё'}
            </span>
          </div>
        </div>
        
        <div className={styles.actions}>
          <button
            className={styles.actionBtn}
            onClick={() => {
              console.log('РђСѓРґРёРѕ Р·РІРѕРЅРѕРє РЅР°Р¶Р°С‚');
              if (socket && chat?.participants && chat.participants.length > 0) {
                const recipientId = chat.participants[0]; // participants СЌС‚Рѕ РјР°СЃСЃРёРІ ID
                socket.emit('call:initiate', {
                  recipientId,
                  callType: 'audio',
                  callerName: user?.displayName || 'РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ'
                });
                setCallType('audio');
                setIsCallModalOpen(true);
              }
            }}
            title="Р“РѕР»РѕСЃРѕРІРѕР№ Р·РІРѕРЅРѕРє"
          >
            <Phone size={20} />
          </button>
          
          <button
            className={styles.actionBtn}
            onClick={() => {
              console.log('Р’РёРґРµРѕ Р·РІРѕРЅРѕРє РЅР°Р¶Р°С‚');
              if (socket && chat?.participants && chat.participants.length > 0) {
                const recipientId = chat.participants[0]; // participants СЌС‚Рѕ РјР°СЃСЃРёРІ ID
                socket.emit('call:initiate', {
                  recipientId,
                  callType: 'video',
                  callerName: user?.displayName || 'РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ'
                });
                setCallType('video');
                setIsCallModalOpen(true);
              }
            }}
            title="Р’РёРґРµРѕР·РІРѕРЅРѕРє"
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
            <p>РќРµС‚ СЃРѕРѕР±С‰РµРЅРёР№</p>
            <span>РќР°С‡РЅРёС‚Рµ РґРёР°Р»РѕРі</span>
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
              title="РџСЂРёРєСЂРµРїРёС‚СЊ С„Р°Р№Р»"
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
              title="Р­РјРѕРґР·Рё"
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
              title="РЎС‚РёРєРµСЂС‹"
            >
              <Sticker size={20} />
            </button>
          </div>

          <input
            ref={inputRef}
            type="text"
            placeholder="РќР°РїРёСЃР°С‚СЊ СЃРѕРѕР±С‰РµРЅРёРµ..."
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
            <div className={styles.pickerHeader}>Р­РјРѕРґР·Рё</div>
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
            <div className={styles.pickerHeader}>РЎС‚РёРєРµСЂС‹</div>
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
        recipientName={chat?.name || 'РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ'}
        recipientId={chatId}
        onClose={() => setIsCallModalOpen(false)}
      />
    </motion.div>
  );
};
