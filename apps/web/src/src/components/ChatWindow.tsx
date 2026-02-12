import { useState } from 'react';
import { motion } from 'framer-motion';
import { Phone, Video, MoreVertical, Smile, Paperclip, Send } from 'lucide-react';
import { Message } from './Message';
import styles from './ChatWindow.module.css';

interface ChatWindowProps {
  chatId: string;
}

const mockMessages = [
  { id: '1', text: 'Привет! Как дела?', isMine: false, time: '14:30', avatar: '👨' },
  { id: '2', text: 'Привет! Все отлично, спасибо! А у тебя?', isMine: true, time: '14:31' },
  { id: '3', text: 'Тоже хорошо! Хотел спросить про проект', isMine: false, time: '14:32', avatar: '👨' },
  { id: '4', text: 'Конечно, слушаю', isMine: true, time: '14:32' },
];

export const ChatWindow = ({ chatId: _chatId }: ChatWindowProps) => {
  const [message, setMessage] = useState('');

  return (
    <motion.div 
      className={styles.container}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      <div className={styles.header}>
        <div className={styles.userInfo}>
          <div className={styles.avatar}>👨</div>
          <div>
            <h3 className={styles.name}>Алексей Иванов</h3>
            <span className={styles.status}>онлайн</span>
          </div>
        </div>
        
        <div className={styles.actions}>
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
            <Phone size={20} />
          </motion.button>
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
            <Video size={20} />
          </motion.button>
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
            <MoreVertical size={20} />
          </motion.button>
        </div>
      </div>

      <div className={styles.messages}>
        {mockMessages.map((msg, index) => (
          <Message key={msg.id} message={msg} index={index} />
        ))}
      </div>

      <div className={styles.inputArea}>
        <motion.button 
          className={styles.iconBtn}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <Paperclip size={20} />
        </motion.button>
        
        <input
          type="text"
          placeholder="Написать сообщение..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className={styles.input}
        />
        
        <motion.button 
          className={styles.iconBtn}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <Smile size={20} />
        </motion.button>
        
        <motion.button 
          className={styles.sendBtn}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Send size={18} />
        </motion.button>
      </div>
    </motion.div>
  );
};
