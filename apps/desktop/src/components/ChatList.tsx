import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Archive, ChevronDown, ChevronRight, Search, Users } from 'lucide-react';
import { ChatListItem } from './ChatListItem';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import styles from './ChatList.module.css';

interface ChatListProps {
  selectedChat: string | null;
  onSelectChat: (chatId: string) => void;
}

export const ChatList = ({ selectedChat, onSelectChat }: ChatListProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchive, setShowArchive] = useState(false);
  const chats = useChatStore((state) => state.chats);
  const loadChats = useChatStore((state) => state.loadChats);
  const isUserOnline = useChatStore((state) => state.isUserOnline);
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    if (token && user) {
      void loadChats();
    }
  }, [token, user, loadChats]);

  const archivedChats = chats.filter((chat) => chat.isArchived);
  const activeChats = chats.filter((chat) => !chat.isArchived);

  const pinnedChats = activeChats.filter((chat) => chat.isPinned);
  const regularChats = activeChats.filter((chat) => !chat.isPinned);

  const filteredPinned = pinnedChats.filter((chat) =>
    chat.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );
  const filteredRegular = regularChats.filter((chat) =>
    chat.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );
  const filteredArchived = archivedChats.filter((chat) =>
    chat.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <motion.div
      className={styles.container}
      initial={{ x: -320 }}
      animate={{ x: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      <div className={styles.searchWrapper}>
        <Search size={18} className={styles.searchIcon} />
        <input
          type="text"
          placeholder="Поиск..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={styles.search}
        />
      </div>

      <div className={styles.list}>
        {archivedChats.length > 0 && (
          <div className={styles.archiveSection}>
            <motion.div
              className={styles.archiveHeader}
              onClick={() => setShowArchive(!showArchive)}
              whileHover={{ backgroundColor: 'var(--bg-hover)' }}
            >
              <Archive size={16} className={styles.archiveIcon} />
              <span className={styles.archiveTitle}>Архив</span>
              <span className={styles.archiveCount}>{archivedChats.length}</span>
              <span className={styles.archiveArrow}>
                {showArchive ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
            </motion.div>

            {showArchive &&
              filteredArchived.map((chat, index) => {
                const otherUserId = chat.participants.find((id) => id !== user?.id);
                const isOnline = otherUserId ? isUserOnline(otherUserId) : false;

                return (
                  <ChatListItem
                    key={chat.id}
                    chat={{
                      id: chat.id,
                      name: chat.name,
                      avatar: chat.avatar,
                      lastMessage: chat.lastMessage || 'Нет сообщений',
                      time: chat.lastMessageTime || '',
                      unread: chat.unread,
                      participants: chat.participants,
                    }}
                    isSelected={selectedChat === chat.id}
                    onClick={() => onSelectChat(chat.id)}
                    index={index}
                    isOnline={isOnline}
                  />
                );
              })}
          </div>
        )}

        {filteredPinned.map((chat, index) => {
          const otherUserId = chat.participants.find((id) => id !== user?.id);
          const isOnline = otherUserId ? isUserOnline(otherUserId) : false;

          return (
            <ChatListItem
              key={chat.id}
              chat={{
                id: chat.id,
                name: chat.name,
                avatar: chat.avatar,
                lastMessage: chat.lastMessage || 'Нет сообщений',
                time: chat.lastMessageTime || '',
                unread: chat.unread,
                participants: chat.participants,
              }}
              isSelected={selectedChat === chat.id}
              onClick={() => onSelectChat(chat.id)}
              index={index}
              isOnline={isOnline}
              isPinned
            />
          );
        })}

        {filteredRegular.length > 0 ? (
          filteredRegular.map((chat, index) => {
            const otherUserId = chat.participants.find((id) => id !== user?.id);
            const isOnline = otherUserId ? isUserOnline(otherUserId) : false;

            return (
              <ChatListItem
                key={chat.id}
                chat={{
                  id: chat.id,
                  name: chat.name,
                  avatar: chat.avatar,
                  lastMessage: chat.lastMessage || 'Нет сообщений',
                  time: chat.lastMessageTime || '',
                  unread: chat.unread,
                  participants: chat.participants,
                }}
                isSelected={selectedChat === chat.id}
                onClick={() => onSelectChat(chat.id)}
                index={index + filteredPinned.length}
                isOnline={isOnline}
              />
            );
          })
        ) : filteredPinned.length === 0 && archivedChats.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={styles.emptyState}
          >
            <Users size={48} className={styles.emptyIcon} />
            <p className={styles.emptyTitle}>Нет чатов</p>
            <p className={styles.emptyText}>Начните новый диалог</p>
          </motion.div>
        ) : null}
      </div>
    </motion.div>
  );
};
