import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import styles from './LoginPage.module.css';

export const LoginPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { login, register } = useAuthStore();

  const formatPhoneNumber = (value: string) => {
    // Удаляем все кроме цифр и +
    const cleaned = value.replace(/[^\d+]/g, '');
    
    // Если начинается с 8, заменяем на +7
    if (cleaned.startsWith('8')) {
      return '+7' + cleaned.slice(1);
    }
    
    // Если начинается с 7, добавляем +
    if (cleaned.startsWith('7') && !cleaned.startsWith('+')) {
      return '+' + cleaned;
    }
    
    // Если нет +, добавляем
    if (!cleaned.startsWith('+') && cleaned.length > 0) {
      return '+' + cleaned;
    }
    
    return cleaned;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhone(formatted);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Валидация номера
    const phoneRegex = /^\+[1-9]\d{10,14}$/;
    if (!phoneRegex.test(phone)) {
      setError('Введите корректный номер телефона в формате +79991234567');
      return;
    }
    
    setLoading(true);

    try {
      if (isLogin) {
        await login(phone, password);
      } else {
        if (!displayName.trim()) {
          setError('Введите имя');
          setLoading(false);
          return;
        }
        await register(phone, password, displayName);
      }
      navigate('/chats');
    } catch (err: any) {
      setError(err.message || (isLogin ? 'Неверный номер или пароль' : 'Ошибка регистрации'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <motion.div 
        className={styles.card}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <motion.div 
          className={styles.logo}
          animate={{ rotate: [0, 5, -5, 0] }}
          transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
        >
          <MessageCircle size={48} />
        </motion.div>
        
        <h1 className={styles.title}>Messenger</h1>
        <p className={styles.subtitle}>
          {isLogin ? 'Войдите в свой аккаунт' : 'Создайте новый аккаунт'}
        </p>

        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              className={styles.error}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <AlertCircle size={16} />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <form className={styles.form} onSubmit={handleSubmit}>
          <AnimatePresence mode="wait">
            {!isLogin && (
              <motion.input
                key="displayName"
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                type="text"
                placeholder="Имя"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className={styles.input}
                required={!isLogin}
              />
            )}
          </AnimatePresence>
          
          <input
            type="tel"
            placeholder="Номер телефона (79991234567)"
            value={phone}
            onChange={handlePhoneChange}
            className={styles.input}
            required
          />
          
          <input
            type="password"
            placeholder="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={styles.input}
            required
          />

          <motion.button
            type="submit"
            className={styles.button}
            whileHover={{ scale: loading ? 1 : 1.02 }}
            whileTap={{ scale: loading ? 1 : 0.98 }}
            disabled={loading}
          >
            {loading ? 'Загрузка...' : (isLogin ? 'Войти' : 'Зарегистрироваться')}
          </motion.button>
        </form>

        <p className={styles.switch}>
          {isLogin ? 'Нет аккаунта?' : 'Уже есть аккаунт?'}
          <span onClick={() => {
            setIsLogin(!isLogin);
            setError('');
          }}>
            {isLogin ? ' Зарегистрироваться' : ' Войти'}
          </span>
        </p>
      </motion.div>
    </div>
  );
};
