import { motion } from 'framer-motion';
import { Phone, Video, PhoneOff } from 'lucide-react';
import styles from './IncomingCallModal.module.css';

interface IncomingCallModalProps {
  isOpen: boolean;
  callerName: string;
  callType: 'audio' | 'video';
  onAnswer: () => void;
  onReject: () => void;
}

export const IncomingCallModal = ({ isOpen, callerName, callType, onAnswer, onReject }: IncomingCallModalProps) => {
  if (!isOpen) return null;

  const firstLetter = callerName.charAt(0).toUpperCase();
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52B788'];
  const colorIndex = firstLetter.charCodeAt(0) % colors.length;
  const avatarColor = colors[colorIndex];

  return (
    <motion.div className={styles.overlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div
        className={styles.modal}
        initial={{ scale: 0.8, y: 50 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 20 }}
      >
        <div className={styles.content}>
          {[0, 0.3, 0.6].map((delay, index) => (
            <motion.div
              key={index}
              className={styles.pulseRing}
              style={{ borderColor: avatarColor }}
              animate={{
                scale: [1, 1.8, 1.8],
                opacity: [0.6, 0.2, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeOut',
                delay,
              }}
            />
          ))}

          <motion.div
            className={styles.avatar}
            style={{
              background: `linear-gradient(135deg, ${avatarColor} 0%, ${avatarColor}dd 100%)`,
              boxShadow: `0 20px 60px ${avatarColor}60`,
            }}
            animate={{
              scale: [1, 1.05, 1],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            {firstLetter}
          </motion.div>

          <h2 className={styles.callerName}>{callerName}</h2>
          <motion.p className={styles.callType} animate={{ opacity: [1, 0.6, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
            {callType === 'video' ? (
              <>
                <Video size={18} /> Входящий видеозвонок...
              </>
            ) : (
              <>
                <Phone size={18} /> Входящий звонок...
              </>
            )}
          </motion.p>

          <div className={styles.buttons}>
            <motion.button
              className={`${styles.button} ${styles.reject}`}
              onClick={onReject}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <PhoneOff size={28} />
              <span>Отклонить</span>
            </motion.button>

            <motion.button
              className={`${styles.button} ${styles.answer}`}
              onClick={onAnswer}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <Phone size={28} />
              <span>Ответить</span>
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
