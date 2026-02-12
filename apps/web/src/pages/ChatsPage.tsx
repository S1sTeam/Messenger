import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus } from 'lucide-react';
import { ChatList } from '../components/ChatList';
import { ChatWindow } from '../components/ChatWindow';
import { NewChatModal } from '../components/NewChatModal';
import { useAuthStore } from '../store/authStore';
import { toBackendUrl } from '../config/network';
import styles from './ChatsPage.module.css';

export const ChatsPage = () => {
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const token = useAuthStore((state) => state.token);

  const handleCreateChat = async (userId: string) => {
    try {
      const response = await fetch(toBackendUrl('/api/chats'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId }),
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedChat(data.chat.id);
        window.location.reload();
      }
    } catch (error) {
      console.error('Failed to create chat:', error);
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
            <Plus size={18} />
          </motion.button>
        </div>
        <ChatList selectedChat={selectedChat} onSelectChat={setSelectedChat} />
      </div>

      <AnimatePresence mode="wait">
        {selectedChat ? (
          <ChatWindow key={selectedChat} chatId={selectedChat} onChatDeleted={() => setSelectedChat(null)} />
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