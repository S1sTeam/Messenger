import { motion } from 'framer-motion';
import { Search, Plus } from 'lucide-react';
import { ChatListItem } from './ChatListItem';
import styles from './ChatList.module.css';

interface ChatListProps {
  selectedChat: string | null;
  onSelectChat: (chatId: string) => void;
}

const mockChats = [
  { id: '1', name: 'Алексей Иванов', avatar: '👨', lastMessage: 'Привет! Как дела?', time: '14:32', unread: 2 },
  { id: '2', name: 'Мария Петрова', avatar: '👩', lastMessage: 'Отправил файлы', time: '13:15', unread: 0 },
  { id: '3', name: 'Команда разработки', avatar: '👥', lastMessage: 'Встреча в 15:00', time: '12:45', unread: 5 },
  { id: '4', name: 'Дмитрий', avatar: '👨‍💻', lastMessage: 'Посмотри код', time: 'Вчера', unread: 0 },
];

export const ChatList = ({ selectedChat, onSelectChat }: ChatListProps) => {
  return (
    <motion.div 
      className={styles.container}
      initial={{ x: -320 }}
      animate={{ x: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      <div className={styles.header}>
        <h2 className={styles.title}>Чаты</h2>
        <motion.button
          className={styles.newChatBtn}
          whileHover={{ scale: 1.1, rotate: 90 }}
          whileTap={{ scale: 0.9 }}
        >
          <Plus size={20} />
        </motion.button>
      </div>

      <div className={styles.searchWrapper}>
        <Search size={18} className={styles.searchIcon} />
        <input
          type="text"
          placeholder="Поиск..."
          className={styles.search}
        />
      </div>

      <div className={styles.list}>
        {mockChats.map((chat, index) => (
          <ChatListItem
            key={chat.id}
            chat={chat}
            isSelected={selectedChat === chat.id}
            onClick={() => onSelectChat(chat.id)}
            index={index}
          />
        ))}
      </div>
    </motion.div>
  );
};
