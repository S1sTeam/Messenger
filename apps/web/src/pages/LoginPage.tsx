import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, AlertCircle, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import styles from './LoginPage.module.css';

type AuthStep = 'phone' | 'verify';

export const LoginPage = () => {
  const [step, setStep] = useState<AuthStep>('phone');
  const [phone, setPhone] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [code, setCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [hint, setHint] = useState('');
  const [debugCode, setDebugCode] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { sendPhoneCode, verifyPhoneCode } = useAuthStore();

  const formatPhoneNumber = (value: string) => {
    const cleaned = value.replace(/[^\d+]/g, '');

    if (cleaned.startsWith('8')) {
      return '+7' + cleaned.slice(1);
    }

    if (cleaned.startsWith('7') && !cleaned.startsWith('+')) {
      return '+' + cleaned;
    }

    if (!cleaned.startsWith('+') && cleaned.length > 0) {
      return '+' + cleaned;
    }

    return cleaned;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhoneNumber(e.target.value));
  };

  const validatePhone = () => {
    const phoneRegex = /^\+[1-9]\d{10,14}$/;
    if (!phoneRegex.test(phone)) {
      setError('Введите корректный номер в формате +79991234567');
      return false;
    }
    return true;
  };

  const handleSendCode = async () => {
    setError('');
    setHint('');
    setDebugCode('');

    if (!validatePhone()) {
      return;
    }

    setLoading(true);
    try {
      const result = await sendPhoneCode(phone, telegramChatId.trim() || undefined);
      setStep('verify');
      setHint(
        result.provider === 'telegram'
          ? 'Код отправлен в Telegram. Проверьте чат с ботом.'
          : 'Код отправлен. Введите 6 цифр из сообщения.'
      );
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
      await verifyPhoneCode(phone, code.trim(), displayName.trim() || undefined);
      navigate('/chats');
    } catch (err: any) {
      setError(err.message || 'Не удалось подтвердить код');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 'phone') {
      await handleSendCode();
      return;
    }
    await handleVerifyCode();
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
          {step === 'phone' ? <MessageCircle size={48} /> : <ShieldCheck size={48} />}
        </motion.div>

        <h1 className={styles.title}>Messenger</h1>
        <p className={styles.subtitle}>
          {step === 'phone' ? 'Вход по номеру телефона' : 'Подтвердите код из SMS'}
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
            type="tel"
            placeholder="Номер телефона (+79991234567)"
            value={phone}
            onChange={handlePhoneChange}
            className={styles.input}
            required
            disabled={step === 'verify'}
          />

          <input
            type="text"
            placeholder="Telegram chat id (один раз для привязки)"
            value={telegramChatId}
            onChange={(e) => setTelegramChatId(e.target.value)}
            className={styles.input}
            disabled={step === 'verify'}
          />

          {step === 'verify' && (
            <>
              <input
                type="text"
                placeholder="Код из SMS"
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
              : step === 'phone'
                ? 'Получить код'
                : 'Подтвердить и войти'}
          </motion.button>
        </form>

        <div className={styles.switch}>
          {step === 'verify' ? (
            <>
              <span
                onClick={() => {
                  setStep('phone');
                  setCode('');
                  setError('');
                  setHint('');
                  setDebugCode('');
                }}
              >
                Изменить номер
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
