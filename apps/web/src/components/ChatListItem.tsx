import { motion } from 'framer-motion';
import { User } from 'lucide-react';
import styles from './ChatListItem.module.css';

interface Chat {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  time: string;
  unread: number;
  participants: string[]; // Добавляем участников для проверки онлайн статуса
}

interface ChatListItemProps {
  chat: Chat;
  isSelected: boolean;
  onClick: () => void;
  index: number;
  isOnline?: boolean;
  isPinned?: boolean;
}

export const ChatListItem = ({ chat, isSelected, onClick, index, isOnline = false, isPinned = false }: ChatListItemProps) => {
  return (
    <motion.div
      className={`${styles.item} ${isSelected ? styles.selected : ''}`}
      onClick={onClick}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ scale: 1.02, x: 4 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className={styles.avatarWrapper}>
        <div className={styles.avatar}>
          <User size={24} strokeWidth={1.5} />
        </div>
        {isOnline && <div className={styles.onlineIndicator} />}
      </div>
      
      <div className={styles.content}>
        <div className={styles.top}>
          <span className={styles.name}>{chat.name}</span>
          {isPinned && <span className={styles.pinIcon}>📌</span>}
          <span className={styles.time}>{chat.time}</span>
        </div>
        
        <div className={styles.bottom}>
          <span className={styles.message}>{chat.lastMessage}</span>
          {chat.unread > 0 && (
            <motion.span 
              className={styles.unread}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 500 }}
            >
              {chat.unread}
            </motion.span>
          )}
        </div>
      </div>
    </motion.div>
  );
};
