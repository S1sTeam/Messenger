import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Plus, Check, LogOut, ArrowLeft, ChevronDown } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import styles from './AccountSwitcher.module.css';

interface Account {
  id: string;
  phone: string;
  displayName: string;
  token: string;
}

export const AccountSwitcher = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const setUser = useAuthStore((state) => state.setUser);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();

  // Получаем все сохранённые аккаунты
  const getAccounts = (): Account[] => {
    const accountsStr = localStorage.getItem('saved-accounts');
    return accountsStr ? JSON.parse(accountsStr) : [];
  };

  // Сохраняем текущий аккаунт
  const saveCurrentAccount = () => {
    if (!user || !token) return;
    
    const accounts = getAccounts();
    const existingIndex = accounts.findIndex(acc => acc.id === user.id);
    
    const account: Account = {
      id: user.id,
      phone: user.phone,
      displayName: user.displayName,
      token
    };

    if (existingIndex >= 0) {
      accounts[existingIndex] = account;
    } else {
      accounts.push(account);
    }

    localStorage.setItem('saved-accounts', JSON.stringify(accounts));
  };

  // Переключение на другой аккаунт
  const switchAccount = (account: Account) => {
    saveCurrentAccount(); // Сохраняем текущий перед переключением
    
    setUser({
      id: account.id,
      phone: account.phone,
      displayName: account.displayName,
      username: undefined,
      avatar: undefined
    }, account.token);
    
    setIsOpen(false);
    window.location.reload(); // Перезагружаем для обновления данных
  };

  // Удаление аккаунта
  const removeAccount = (accountId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    const accounts = getAccounts().filter(acc => acc.id !== accountId);
    localStorage.setItem('saved-accounts', JSON.stringify(accounts));
    
    // Если удалили текущий аккаунт, выходим
    if (user?.id === accountId) {
      logout();
      navigate('/login');
    }
    
    setIsOpen(false);
  };

  // Добавить новый аккаунт
  const addNewAccount = () => {
    saveCurrentAccount();
    setIsOpen(false);
    setIsAddingAccount(false);
    logout();
    navigate('/login');
  };

  const accounts = getAccounts();
  const otherAccounts = accounts.filter(acc => acc.id !== user?.id);

  return (
    <div className={styles.container}>
      <motion.button
        className={styles.trigger}
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <div className={styles.avatar}>
          <User size={20} />
        </div>
        <div className={styles.userInfo}>
          <div className={styles.name}>{user?.displayName}</div>
          <div className={styles.phone}>{user?.phone}</div>
        </div>
        <ChevronDown size={16} className={styles.chevron} />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              className={styles.overlay}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsOpen(false);
                setIsAddingAccount(false);
              }}
            />
            <motion.div
              className={styles.menu}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {!isAddingAccount ? (
                <>
                  <div className={styles.menuHeader}>Аккаунты</div>
                  
                  {/* Текущий аккаунт - некликабельный */}
                  <div className={`${styles.accountItem} ${styles.currentAccount}`} style={{ cursor: 'default' }}>
                    <div className={styles.accountAvatar}>
                      <User size={18} />
                    </div>
                    <div className={styles.accountInfo}>
                      <div className={styles.accountName}>{user?.displayName}</div>
                      <div className={styles.accountPhone}>{user?.phone}</div>
                    </div>
                    <Check size={18} className={styles.checkIcon} />
                  </div>

                  {/* Другие аккаунты */}
                  {otherAccounts.length > 0 && (
                    <>
                      <div className={styles.divider} />
                      {otherAccounts.map((account) => (
                        <motion.div
                          key={account.id}
                          className={styles.accountItem}
                          onClick={() => switchAccount(account)}
                          whileHover={{ backgroundColor: 'var(--bg-hover)' }}
                        >
                          <div className={styles.accountAvatar}>
                            <User size={18} />
                          </div>
                          <div className={styles.accountInfo}>
                            <div className={styles.accountName}>{account.displayName}</div>
                            <div className={styles.accountPhone}>{account.phone}</div>
                          </div>
                          <button
                            className={styles.removeBtn}
                            onClick={(e) => removeAccount(account.id, e)}
                            title="Удалить аккаунт"
                          >
                            <LogOut size={16} />
                          </button>
                        </motion.div>
                      ))}
                    </>
                  )}

                  <div className={styles.divider} />
                  
                  <motion.button
                    className={styles.addAccount}
                    onClick={() => setIsAddingAccount(true)}
                    whileHover={{ backgroundColor: 'var(--bg-hover)' }}
                  >
                    <Plus size={18} />
                    <span>Добавить аккаунт</span>
                  </motion.button>
                </>
              ) : (
                <>
                  <div className={styles.menuHeader}>
                    <button 
                      className={styles.backBtn}
                      onClick={() => setIsAddingAccount(false)}
                    >
                      <ArrowLeft size={20} />
                    </button>
                    <span>Добавить аккаунт</span>
                  </div>
                  
                  <div className={styles.addAccountContent}>
                    <p className={styles.addAccountText}>
                      Вы уверены, что хотите добавить новый аккаунт?
                    </p>
                    <p className={styles.addAccountHint}>
                      Текущий аккаунт будет сохранен, и вы сможете переключаться между ними.
                    </p>
                    
                    <div className={styles.addAccountButtons}>
                      <motion.button
                        className={styles.cancelBtn}
                        onClick={() => setIsAddingAccount(false)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        Отмена
                      </motion.button>
                      <motion.button
                        className={styles.confirmBtn}
                        onClick={addNewAccount}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        Добавить
                      </motion.button>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
