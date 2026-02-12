import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, AlertCircle, ShieldCheck, ArrowLeft } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import styles from './LoginPage.module.css';

type AuthStep = 'email' | 'verify';
type SavedAccount = {
  id: string;
  phone: string;
  displayName: string;
  token: string;
};

const ADD_ACCOUNT_MODE_KEY = 'add-account-mode';
const ADD_ACCOUNT_RETURN_ID_KEY = 'add-account-return-id';

export const LoginPage = () => {
  const [step, setStep] = useState<AuthStep>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [hint, setHint] = useState('');
  const [debugCode, setDebugCode] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { sendEmailCode, verifyEmailCode, setUser } = useAuthStore();

  const getSavedAccounts = (): SavedAccount[] => {
    const raw = localStorage.getItem('saved-accounts');
    if (!raw) return [];

    try {
      return JSON.parse(raw) as SavedAccount[];
    } catch {
      return [];
    }
  };

  const getReturnAccount = (): SavedAccount | null => {
    if (localStorage.getItem(ADD_ACCOUNT_MODE_KEY) !== '1') {
      return null;
    }

    const accounts = getSavedAccounts();
    if (accounts.length === 0) return null;

    const returnId = localStorage.getItem(ADD_ACCOUNT_RETURN_ID_KEY);
    if (returnId) {
      const matched = accounts.find((account) => account.id === returnId);
      if (matched) return matched;
    }

    return accounts[0];
  };

  const [returnAccount] = useState<SavedAccount | null>(() => getReturnAccount());
  const canCancelAddAccount = returnAccount !== null;

  const clearAddAccountMode = () => {
    localStorage.removeItem(ADD_ACCOUNT_MODE_KEY);
    localStorage.removeItem(ADD_ACCOUNT_RETURN_ID_KEY);
  };

  const normalizeEmail = (value: string) => value.trim().toLowerCase();

  const validateEmail = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Введите корректный email, например user@gmail.com');
      return false;
    }
    return true;
  };

  const handleSendCode = async () => {
    setError('');
    setHint('');
    setDebugCode('');

    if (!validateEmail()) {
      return;
    }

    setLoading(true);
    try {
      const result = await sendEmailCode(email);
      setStep('verify');
      setHint('Код отправлен на ваш email. Проверьте входящие и спам.');
      if (result.debugCode) {
        setDebugCode(result.debugCode);
      }
    } catch (err: any) {
      setError(err.message || 'Не удалось отправить код');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    setError('');

    if (!/^\d{6}$/.test(code.trim())) {
      setError('Введите 6-значный код');
      return;
    }

    setLoading(true);
    try {
      await verifyEmailCode(email, code.trim(), displayName.trim() || undefined);
      clearAddAccountMode();
      navigate('/chats');
    } catch (err: any) {
      setError(err.message || 'Не удалось подтвердить код');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 'email') {
      await handleSendCode();
      return;
    }
    await handleVerifyCode();
  };

  const handleCancelAddAccount = () => {
    if (!returnAccount) return;

    setUser(
      {
        id: returnAccount.id,
        phone: returnAccount.phone,
        email: returnAccount.phone,
        displayName: returnAccount.displayName,
        username: undefined,
        avatar: undefined,
      },
      returnAccount.token
    );

    clearAddAccountMode();
    navigate('/chats');
    window.location.reload();
  };

  return (
    <div className={styles.container}>
      <motion.div
        className={styles.card}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {canCancelAddAccount && (
          <motion.button
            type="button"
            className={styles.cancelAction}
            whileHover={{ x: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleCancelAddAccount}
          >
            <ArrowLeft size={16} />
            <span>Назад</span>
          </motion.button>
        )}

        <motion.div
          className={styles.logo}
          animate={{ rotate: [0, 5, -5, 0] }}
          transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
        >
          {step === 'email' ? <MessageCircle size={48} /> : <ShieldCheck size={48} />}
        </motion.div>

        <h1 className={styles.title}>Messenger</h1>
        <p className={styles.subtitle}>
          {step === 'email' ? 'Вход по email' : 'Подтвердите код из письма'}
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

        <AnimatePresence mode="wait">
          {hint && !error && (
            <motion.div
              className={styles.switch}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              style={{ marginTop: 0, marginBottom: 12 }}
            >
              {hint}
            </motion.div>
          )}
        </AnimatePresence>

        {debugCode && (
          <div className={styles.switch} style={{ marginTop: 0, marginBottom: 12 }}>
            Debug code: <strong>{debugCode}</strong>
          </div>
        )}

        <form className={styles.form} onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email (user@gmail.com)"
            value={email}
            onChange={(e) => setEmail(normalizeEmail(e.target.value))}
            className={styles.input}
            required
            disabled={step === 'verify'}
          />

          {step === 'verify' && (
            <>
              <input
                type="text"
                placeholder="Код из письма"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className={styles.input}
                inputMode="numeric"
                required
              />
              <input
                type="text"
                placeholder="Имя (для нового аккаунта)"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className={styles.input}
              />
            </>
          )}

          <motion.button
            type="submit"
            className={styles.button}
            whileHover={{ scale: loading ? 1 : 1.02 }}
            whileTap={{ scale: loading ? 1 : 0.98 }}
            disabled={loading}
          >
            {loading
              ? 'Загрузка...'
              : step === 'email'
                ? 'Получить код'
                : 'Подтвердить и войти'}
          </motion.button>
        </form>

        <div className={styles.switch}>
          {step === 'verify' ? (
            <>
              <span
                onClick={() => {
                  setStep('email');
                  setCode('');
                  setError('');
                  setHint('');
                  setDebugCode('');
                }}
              >
                Изменить email
              </span>
              {' • '}
              <span
                onClick={() => {
                  handleSendCode();
                }}
              >
                Отправить код еще раз
              </span>
            </>
          ) : (
            'После подтверждения кода аккаунт создастся автоматически'
          )}
        </div>
      </motion.div>
    </div>
  );
};