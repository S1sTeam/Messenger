import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Bell, BellOff, Trash2, Archive, Pin, PinOff } from 'lucide-react';
import { ConfirmDialog } from './ConfirmDialog';
import { useChatStore } from '../store/chatStore';
import styles from './ChatMenu.module.css';

interface ChatMenuProps {
  chatId: string;
  onDeleteChat?: () => void;
}

export const ChatMenu = ({ chatId, onDeleteChat }: ChatMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);
  
  const loadChats = useChatStore(state => state.loadChats);

  const handleMute = async () => {
    try {
      const authStorage = localStorage.getItem('auth-storage');
      if (!authStorage) return;
      
      const { state } = JSON.parse(authStorage);
      const token = state?.token;

      const response = await fetch(`http://localhost:3000/api/chats/${chatId}/mute`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isMuted: !isMuted })
      });

      if (response.ok) {
        setIsMuted(!isMuted);
        console.log(isMuted ? '✅ Уведомления включены' : '🔕 Уведомления отключены');
      }
    } catch (error) {
      console.error('❌ Ошибка изменения уведомлений:', error);
    }
  };

  const handlePin = async () => {
    try {
      const authStorage = localStorage.getItem('auth-storage');
      if (!authStorage) return;
      
      const { state } = JSON.parse(authStorage);
      const token = state?.token;

      const response = await fetch(`http://localhost:3000/api/chats/${chatId}/pin`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isPinned: !isPinned })
      });

      if (response.ok) {
        setIsPinned(!isPinned);
        console.log(isPinned ? '📌 Чат откреплен' : '📍 Чат закреплен');
        await loadChats();
      }
    } catch (error) {
      console.error('❌ Ошибка закрепления чата:', error);
    }
  };

  const handleArchive = () => {
    setIsArchiveDialogOpen(true);
  };

  const confirmArchive = async () => {
    try {
      const authStorage = localStorage.getItem('auth-storage');
      if (!authStorage) return;
      
      const { state } = JSON.parse(authStorage);
      const token = state?.token;

      const response = await fetch(`http://localhost:3000/api/chats/${chatId}/archive`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isArchived: true })
      });

      if (response.ok) {
        console.log('📦 Чат архивирован');
        setIsArchiveDialogOpen(false);
        await loadChats();
      }
    } catch (error) {
      console.error('❌ Ошибка архивации чата:', error);
    }
  };

  const handleDelete = () => {
    console.log('🗑️ handleDelete вызван, открываем диалог');
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    try {
      console.log('🗑️ Удаление чата:', chatId);
      
      const authStorage = localStorage.getItem('auth-storage');
      if (!authStorage) {
        console.error('❌ Нет токена авторизации');
        return;
      }
      
      const { state } = JSON.parse(authStorage);
      const token = state?.token;

      console.log('📤 Отправка DELETE запроса на:', `http://localhost:3000/api/chats/${chatId}`);

      const response = await fetch(`http://localhost:3000/api/chats/${chatId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      console.log('📥 Ответ сервера:', response.status, response.statusText);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Чат успешно удален:', data);
        setIsDeleteDialogOpen(false);
        await loadChats();
        if (onDeleteChat) {
          onDeleteChat();
        }
      } else {
        const errorData = await response.json();
        console.error('❌ Ошибка удаления чата:', errorData);
        alert(`Ошибка: ${errorData.error || 'Не удалось удалить чат'}`);
      }
    } catch (error) {
      console.error('❌ Ошибка удаления чата:', error);
      alert('Произошла ошибка при удалении чата');
    }
  };

  const handleSearch = () => {
    setShowSearch(!showSearch);
    console.log('Поиск в чате');
    // TODO: Implement search functionality
  };

  const menuItems = [
    { icon: Search, label: 'Поиск в чате', action: handleSearch },
    { 
      icon: isMuted ? Bell : BellOff, 
      label: isMuted ? 'Включить уведомления' : 'Отключить уведомления', 
      action: handleMute 
    },
    { 
      icon: isPinned ? PinOff : Pin, 
      label: isPinned ? 'Открепить чат' : 'Закрепить чат', 
      action: handlePin 
    },
    { icon: Archive, label: 'Архивировать', action: handleArchive },
    { icon: Trash2, label: 'Удалить чат', action: handleDelete, danger: true },
  ];

  return (
    <div className={styles.container}>
      <motion.button
        className={styles.trigger}
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        title="Меню чата"
      >
        <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#999', lineHeight: '1' }}>⋮</span>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              className={styles.overlay}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              className={styles.menu}
              initial={{ opacity: 0, scale: 0.9, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {menuItems.map((item, index) => (
                <motion.button
                  key={index}
                  className={`${styles.menuItem} ${item.danger ? styles.danger : ''}`}
                  onClick={() => {
                    setIsOpen(false);
                    // Небольшая задержка чтобы меню успело закрыться
                    setTimeout(() => {
                      item.action();
                    }, 100);
                  }}
                  whileHover={{ backgroundColor: 'var(--bg-hover)' }}
                >
                  <item.icon size={18} />
                  <span>{item.label}</span>
                </motion.button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        title="Удалить чат?"
        message="Это действие нельзя отменить. Все сообщения будут удалены навсегда."
        confirmText="Удалить"
        cancelText="Отмена"
        onConfirm={confirmDelete}
        onCancel={() => setIsDeleteDialogOpen(false)}
        danger={true}
      />

      <ConfirmDialog
        isOpen={isArchiveDialogOpen}
        title="Архивировать чат?"
        message="Чат будет перемещен в архив. Вы сможете восстановить его позже."
        confirmText="Архивировать"
        cancelText="Отмена"
        onConfirm={confirmArchive}
        onCancel={() => setIsArchiveDialogOpen(false)}
        danger={false}
      />
    </div>
  );
};
