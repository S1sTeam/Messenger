import { NavLink, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MessageCircle, Rss, User, Settings, LogOut } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import styles from './Sidebar.module.css';

const navItems = [
  { path: '/chats', icon: MessageCircle, label: 'Чаты' },
  { path: '/feed', icon: Rss, label: 'Лента' },
  { path: '/profile', icon: User, label: 'Профиль' },
];

export const Sidebar = () => {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <motion.div 
      className={styles.sidebar}
      initial={{ x: -80 }}
      animate={{ x: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className={styles.logo}>
        <MessageCircle size={28} />
      </div>

      <nav className={styles.nav}>
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => 
              `${styles.navItem} ${isActive ? styles.active : ''}`
            }
          >
            <motion.div
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              className={styles.iconWrapper}
            >
              <item.icon size={24} />
            </motion.div>
            <span className={styles.tooltip}>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className={styles.bottom}>
        <motion.button
          className={styles.navItem}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          <Settings size={24} />
          <span className={styles.tooltip}>Настройки</span>
        </motion.button>
        
        <motion.button
          className={styles.navItem}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleLogout}
        >
          <LogOut size={24} />
          <span className={styles.tooltip}>Выход</span>
        </motion.button>
      </div>
    </motion.div>
  );
};
