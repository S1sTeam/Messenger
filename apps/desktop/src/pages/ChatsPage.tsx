import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { ChatList } from '../components/ChatList';
import { ChatWindow } from '../components/ChatWindow';
import { NewChatModal } from '../components/NewChatModal';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import styles from './ChatsPage.module.css';

export const ChatsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const token = useAuthStore((state) => state.token);
  const loadChats = useChatStore((state) => state.loadChats);

  useEffect(() => {
    const chatId = searchParams.get('chatId');
    if (chatId) {
      setSelectedChat(chatId);
    }
  }, [searchParams]);

  const selectChat = (chatId: string | null) => {
    setSelectedChat(chatId);

    if (chatId) {
      setSearchParams({ chatId });
    } else {
      setSearchParams({});
    }
  };

  const handleCreateChat = async (userId: string) => {
    try {
      const response = await fetch('/api/chats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        alert(error.error || 'Не удалось открыть чат');
        return;
      }

      const data = await response.json();
      await loadChats();
      selectChat(data.chat.id);
    } catch (error) {
      console.error('Failed to create chat:', error);
      alert('Не удалось открыть чат');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.chatListWrapper}>
        <div className={styles.header}>
          <h2>Чаты</h2>
          <motion.button
            className={styles.newChatBtn}
            onClick={() => setIsNewChatModalOpen(true)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title="Новый чат"
          >
            <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#999', lineHeight: '1' }}>+</span>
          </motion.button>
        </div>
        <ChatList selectedChat={selectedChat} onSelectChat={(chatId) => selectChat(chatId)} />
      </div>

      <AnimatePresence mode="wait">
        {selectedChat ? (
          <ChatWindow key={selectedChat} chatId={selectedChat} onChatDeleted={() => selectChat(null)} />
        ) : (
          <motion.div
            key="empty"
            className={styles.empty}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <p>Выберите чат для начала общения</p>
          </motion.div>
        )}
      </AnimatePresence>

      <NewChatModal
        isOpen={isNewChatModalOpen}
        onClose={() => setIsNewChatModalOpen(false)}
        onCreateChat={handleCreateChat}
      />
    </div>
  );
};
