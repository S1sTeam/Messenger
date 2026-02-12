import { motion } from 'framer-motion';
import { Edit2, Mail, Phone, MapPin } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import styles from './ProfilePage.module.css';

export const ProfilePage = () => {
  const user = useAuthStore((state) => state.user);

  return (
    <motion.div 
      className={styles.container}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className={styles.header}>
        <h2 className={styles.title}>Профиль</h2>
      </div>

      <div className={styles.content}>
        <motion.div 
          className={styles.card}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <div className={styles.avatarSection}>
            <div className={styles.avatarLarge}>{user?.avatar || '👤'}</div>
            <motion.button
              className={styles.editBtn}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Edit2 size={16} />
              Изменить фото
            </motion.button>
          </div>

          <div className={styles.info}>
            <h3 className={styles.name}>{user?.displayName || 'Пользователь'}</h3>
            <p className={styles.username}>@{user?.username || 'username'}</p>
            <p className={styles.bio}>Разработчик | Люблю создавать крутые приложения</p>
          </div>

          <div className={styles.stats}>
            <div className={styles.stat}>
              <div className={styles.statValue}>142</div>
              <div className={styles.statLabel}>Подписчики</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statValue}>89</div>
              <div className={styles.statLabel}>Подписки</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statValue}>234</div>
              <div className={styles.statLabel}>Посты</div>
            </div>
          </div>

          <div className={styles.details}>
            <div className={styles.detail}>
              <Mail size={18} />
              <span>{user?.username}@messenger.com</span>
            </div>
            <div className={styles.detail}>
              <Phone size={18} />
              <span>+7 (999) 123-45-67</span>
            </div>
            <div className={styles.detail}>
              <MapPin size={18} />
              <span>Москва, Россия</span>
            </div>
          </div>

          <motion.button
            className={styles.editProfileBtn}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Редактировать профиль
          </motion.button>
        </motion.div>
      </div>
    </motion.div>
  );
};
