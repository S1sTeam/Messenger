import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChatList } from '../components/ChatList';
import { ChatWindow } from '../components/ChatWindow';
import styles from './ChatsPage.module.css';

export const ChatsPage = () => {
  const [selectedChat, setSelectedChat] = useState<string | null>(null);

  return (
    <div className={styles.container}>
      <ChatList 
        selectedChat={selectedChat} 
        onSelectChat={setSelectedChat} 
      />
      
      <AnimatePresence mode="wait">
        {selectedChat ? (
          <ChatWindow key={selectedChat} chatId={selectedChat} />
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
    </div>
  );
};
