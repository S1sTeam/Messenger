import { NavLink } from 'react-router-dom';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, Rss, User, Settings, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { AccountSwitcher } from './AccountSwitcher';
import styles from './Sidebar.module.css';

const navItems = [
  { path: '/chats', icon: MessageCircle, label: 'Чаты' },
  { path: '/feed', icon: Rss, label: 'Лента' },
  { path: '/profile', icon: User, label: 'Профиль' },
];

export const Sidebar = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <motion.div 
      className={styles.sidebar}
      style={{ width: isCollapsed ? 88 : 280 }}
      initial={{ x: -280 }}
      animate={{ x: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className={styles.logo}>
        <MessageCircle size={32} />
      </div>

      <nav className={styles.nav}>
        <motion.button
          className={styles.navItem}
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? 'Развернуть меню' : 'Свернуть меню'}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className={styles.iconWrapper}>
            {isCollapsed ? <PanelLeftOpen size={24} /> : <PanelLeftClose size={24} />}
          </div>
          {!isCollapsed && <span className={styles.label}>Свернуть</span>}
        </motion.button>

        <div className={styles.divider} />

        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => 
              `${styles.navItem} ${isActive ? styles.active : ''}`
            }
            title={isCollapsed ? item.label : undefined}
          >
            <div className={styles.iconWrapper}>
              <item.icon size={24} />
            </div>
            {!isCollapsed && <span className={styles.label}>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className={styles.bottom}>
        {!isCollapsed && (
          <motion.div 
            className={styles.accountSwitcherWrapper}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <AccountSwitcher />
          </motion.div>
        )}
        
        <NavLink
          to="/settings"
          className={({ isActive }) => 
            `${styles.navItem} ${isActive ? styles.active : ''}`
          }
          title={isCollapsed ? 'Настройки' : undefined}
        >
          <div className={styles.iconWrapper}>
            <Settings size={24} />
          </div>
          {!isCollapsed && <span className={styles.label}>Настройки</span>}
        </NavLink>
      </div>
    </motion.div>
  );
};
