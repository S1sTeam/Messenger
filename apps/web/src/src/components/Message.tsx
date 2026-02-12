import { motion } from 'framer-motion';
import styles from './Message.module.css';

interface MessageProps {
  message: {
    id: string;
    text: string;
    isMine: boolean;
    time: string;
    avatar?: string;
  };
  index: number;
}

export const Message = ({ message, index }: MessageProps) => {
  return (
    <motion.div
      className={`${styles.wrapper} ${message.isMine ? styles.mine : ''}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      {!message.isMine && message.avatar && (
        <div className={styles.avatar}>{message.avatar}</div>
      )}
      
      <motion.div
        className={`${styles.bubble} ${message.isMine ? styles.mineBubble : ''}`}
        whileHover={{ scale: 1.02 }}
      >
        <p className={styles.text}>{message.text}</p>
        <span className={styles.time}>{message.time}</span>
      </motion.div>
    </motion.div>
  );
};
