import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, User, Loader } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import styles from './NewChatModal.module.css';

interface User {
  id: string;
  displayName: string;
  username?: string;
  phone: string;
  avatar?: string;
  bio?: string;
}

interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateChat: (userId: string) => void;
}

export const NewChatModal = ({ isOpen, onClose, onCreateChat }: NewChatModalProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const token = useAuthStore((state) => state.token);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    
    if (query.trim().length === 0) {
      setUsers([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`http://localhost:3000/api/users/search?q=${encodeURIComponent(query)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectUser = (userId: string) => {
    onCreateChat(userId);
    onClose();
    setSearchQuery('');
    setUsers([]);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className={styles.overlay}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className={styles.modal}
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles.header}>
            <h3>Новый чат</h3>
            <button onClick={onClose} className={styles.closeBtn}>
              <X size={20} />
            </button>
          </div>

          <div className={styles.searchBox}>
            <Search size={20} style={{ color: '#999', stroke: '#999', fill: 'none' }} />
            <input
              type="text"
              placeholder="Поиск по имени, username или номеру..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              autoFocus
            />
            {loading && <Loader size={20} className={styles.spinner} />}
          </div>

          <div className={styles.userList}>
            {searchQuery.length === 0 && (
              <div className={styles.empty}>
                <Search size={48} style={{ color: '#666', stroke: '#666', fill: 'none' }} />
                <p>Введите имя или номер для поиска</p>
              </div>
            )}

            {searchQuery.length > 0 && users.length === 0 && !loading && (
              <div className={styles.empty}>
                <User size={48} style={{ color: '#666', stroke: '#666', fill: 'none' }} />
                <p>Пользователи не найдены</p>
              </div>
            )}

            {users.map((user) => (
              <motion.div
                key={user.id}
                className={styles.userItem}
                onClick={() => handleSelectUser(user.id)}
                whileHover={{ backgroundColor: 'var(--bg-hover)' }}
                whileTap={{ scale: 0.98 }}
              >
                <div className={styles.avatar}>
                  <User size={24} />
                </div>
                <div className={styles.userInfo}>
                  <div className={styles.userName}>{user.displayName}</div>
                  <div className={styles.userDetails}>
                    {user.username && `@${user.username} • `}
                    {user.phone}
                  </div>
                  {user.bio && <div className={styles.userBio}>{user.bio}</div>}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
