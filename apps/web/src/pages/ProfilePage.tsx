import { useState } from 'react';
import { motion } from 'framer-motion';
import { Edit2, Mail, MapPin, User, Calendar, Link as LinkIcon, Settings } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import styles from './ProfilePage.module.css';

export const ProfilePage = () => {
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const handleEditProfile = () => {
    navigate('/settings');
  };

  const handleShare = () => {
    const profileUrl = `messenger.app/${user?.username}`;
    navigator.clipboard.writeText(profileUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
            <div className={styles.avatarLarge}>
              <User size={48} strokeWidth={1.5} />
            </div>
            <motion.button
              className={styles.editBtn}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleEditProfile}
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
            <motion.div 
              className={styles.stat}
              whileHover={{ scale: 1.05 }}
            >
              <div className={styles.statValue}>142</div>
              <div className={styles.statLabel}>Подписчики</div>
            </motion.div>
            <motion.div 
              className={styles.stat}
              whileHover={{ scale: 1.05 }}
            >
              <div className={styles.statValue}>89</div>
              <div className={styles.statLabel}>Подписки</div>
            </motion.div>
            <motion.div 
              className={styles.stat}
              whileHover={{ scale: 1.05 }}
            >
              <div className={styles.statValue}>234</div>
              <div className={styles.statLabel}>Посты</div>
            </motion.div>
          </div>

          <div className={styles.details}>
            <div className={styles.detail}>
              <Mail size={18} />
              <span>{user?.email || user?.phone || 'email@example.com'}</span>
            </div>
            <div className={styles.detail}>
              <User size={18} />
              <span>@{user?.username || 'username'}</span>
            </div>
            <div className={styles.detail}>
              <MapPin size={18} />
              <span>Москва, Россия</span>
            </div>
            <div className={styles.detail}>
              <Calendar size={18} />
              <span>Регистрация: {new Date().toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}</span>
            </div>
            <div className={styles.detail}>
              <LinkIcon size={18} />
              <span className={styles.link} onClick={handleShare}>
                messenger.app/{user?.username}
              </span>
            </div>
          </div>

          <div className={styles.actions}>
            <motion.button
              className={styles.editProfileBtn}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleEditProfile}
            >
              <Settings size={18} />
              Настройки профиля
            </motion.button>
            
            <motion.button
              className={styles.shareBtn}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleShare}
            >
              <LinkIcon size={18} />
              {copied ? 'Скопировано!' : 'Поделиться'}
            </motion.button>
          </div>
        </motion.div>

        <motion.div 
          className={styles.card}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <h3 className={styles.sectionTitle}>Активность</h3>
          
          <div className={styles.activityList}>
            <motion.div 
              className={styles.activityItem}
              whileHover={{ x: 4 }}
            >
              <div className={styles.activityIcon}>
                <Mail size={20} />
              </div>
              <div className={styles.activityContent}>
                <div className={styles.activityTitle}>Сообщений отправлено</div>
                <div className={styles.activityValue}>1,234</div>
              </div>
            </motion.div>

            <motion.div 
              className={styles.activityItem}
              whileHover={{ x: 4 }}
            >
              <div className={styles.activityIcon}>
                <User size={20} />
              </div>
              <div className={styles.activityContent}>
                <div className={styles.activityTitle}>Активных чатов</div>
                <div className={styles.activityValue}>12</div>
              </div>
            </motion.div>

            <motion.div 
              className={styles.activityItem}
              whileHover={{ x: 4 }}
            >
              <div className={styles.activityIcon}>
                <Calendar size={20} />
              </div>
              <div className={styles.activityContent}>
                <div className={styles.activityTitle}>Дней в сети</div>
                <div className={styles.activityValue}>45</div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};
