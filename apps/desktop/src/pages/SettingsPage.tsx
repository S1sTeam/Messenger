import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { User, Bell, Lock, Palette, Globe, Moon, Sun, Shield, Eye, EyeOff, Save, LogOut, Check, Camera } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import { setThemeFromDarkMode } from '../utils/theme';
import styles from './SettingsPage.module.css';

interface UserSettings {
  notifications: boolean;
  notificationSound: boolean;
  darkMode: boolean;
  fontSize: string;
  language: string;
  twoFactorAuth: boolean;
}

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,24}$/;
const MIN_PASSWORD_LENGTH = 8;

export const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState('profile');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [settings, setSettings] = useState<UserSettings>({
    notifications: true,
    notificationSound: true,
    darkMode: true,
    fontSize: 'medium',
    language: 'ru',
    twoFactorAuth: false,
  });

  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const setUser = useAuthStore((state) => state.setUser);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();

  useEffect(() => {
    if (token) {
      void loadSettings();
    }
  }, [token]);

  const getErrorMessage = async (response: Response, fallbackMessage: string) => {
    try {
      const data = await response.json();
      if (typeof data?.error === 'string' && data.error.trim().length > 0) {
        return data.error;
      }
    } catch (error) {
      console.error('Failed to parse error response:', error);
    }

    return fallbackMessage;
  };

  const loadSettings = async () => {
    if (!token) return;

    try {
      const response = await fetch('http://localhost:3000/api/settings', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        console.error('Failed to load settings, status:', response.status);
        return;
      }

      const data = await response.json();
      setDisplayName(data.user.displayName || '');
      setUsername(data.user.username || '');
      setBio(data.user.bio || '');
      setAvatarUrl(data.user.avatar || '');
      setSettings(data.settings);
      setThemeFromDarkMode(Boolean(data.settings?.darkMode));
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const handleSaveProfile = async () => {
    if (!token) {
      alert('Сессия истекла. Войдите снова');
      return;
    }

    const normalizedDisplayName = displayName.trim();
    const normalizedUsername = username.trim();
    const normalizedBio = bio.trim();

    if (normalizedDisplayName.length < 2) {
      alert('Имя должно содержать минимум 2 символа');
      return;
    }

    if (normalizedDisplayName.length > 50) {
      alert('Имя слишком длинное (максимум 50 символов)');
      return;
    }

    if (normalizedUsername && !USERNAME_PATTERN.test(normalizedUsername)) {
      alert('Username: 3-24 символа, только латиница, цифры и _');
      return;
    }

    if (normalizedBio.length > 160) {
      alert('Описание должно быть не длиннее 160 символов');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('http://localhost:3000/api/settings/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          username: normalizedUsername || undefined,
          displayName: normalizedDisplayName,
          bio: normalizedBio,
        }),
      });

      if (!response.ok) {
        const errorMessage = await getErrorMessage(response, 'Ошибка сохранения профиля');
        alert(errorMessage);
        return;
      }

      const data = await response.json();
      setDisplayName(data.user?.displayName ?? normalizedDisplayName);
      setUsername(data.user?.username ?? normalizedUsername);
      setBio(data.user?.bio ?? normalizedBio);

      if (user) {
        setUser(
          {
            id: user.id,
            phone: user.phone,
            displayName: data.user?.displayName ?? normalizedDisplayName,
            username: data.user?.username ?? (normalizedUsername || undefined),
            avatar: data.user?.avatar ?? user.avatar,
          },
          token,
        );
      }

      showSuccessMessage();
    } catch (error) {
      console.error('Failed to save profile:', error);
      alert('Ошибка сохранения профиля');
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!token) {
      alert('Сессия истекла. Войдите снова');
      return;
    }

    if (!file.type.startsWith('image/')) {
      alert('Пожалуйста, выберите изображение');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Файл слишком большой. Максимальный размер: 5MB');
      return;
    }

    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const uploadResponse = await fetch('http://localhost:3000/api/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(errorData.error || 'Ошибка загрузки файла');
      }

      const uploadData = await uploadResponse.json();
      const updateResponse = await fetch('http://localhost:3000/api/settings/avatar', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ avatar: uploadData.url }),
      });

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json();
        throw new Error(errorData.error || 'Ошибка обновления аватара');
      }

      const userData = await updateResponse.json();
      setAvatarUrl(uploadData.url);

      if (token && user) {
        setUser(
          {
            id: user.id,
            phone: user.phone,
            displayName: user.displayName,
            username: user.username,
            avatar: userData.user?.avatar ?? uploadData.url,
          },
          token,
        );
      }

      showSuccessMessage();
    } catch (error) {
      console.error('Avatar upload error:', error);
      alert(`Не удалось загрузить аватар: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) {
        avatarInputRef.current.value = '';
      }
    }
  };

  const handleChangePassword = async () => {
    if (!token) {
      alert('Сессия истекла. Войдите снова');
      return;
    }

    if (!currentPassword || !newPassword) {
      alert('Заполните все поля');
      return;
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      alert(`Новый пароль должен быть не короче ${MIN_PASSWORD_LENGTH} символов`);
      return;
    }

    if (newPassword === currentPassword) {
      alert('Новый пароль должен отличаться от текущего');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('http://localhost:3000/api/settings/password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (!response.ok) {
        const errorMessage = await getErrorMessage(response, 'Ошибка изменения пароля');
        alert(errorMessage);
        return;
      }

      setCurrentPassword('');
      setNewPassword('');
      showSuccessMessage();
    } catch (error) {
      console.error('Failed to change password:', error);
      alert('Ошибка изменения пароля');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!token) {
      alert('Сессия истекла. Войдите снова');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('http://localhost:3000/api/settings/preferences', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        const errorMessage = await getErrorMessage(response, 'Ошибка сохранения настроек');
        alert(errorMessage);
        return;
      }

      const data = await response.json();
      if (data?.settings) {
        setSettings(data.settings);
        setThemeFromDarkMode(Boolean(data.settings.darkMode));
      }
      showSuccessMessage();
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Ошибка сохранения настроек');
    } finally {
      setLoading(false);
    }
  };

  const showSuccessMessage = () => {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const tabs = [
    { id: 'profile', label: 'Профиль', icon: User },
    { id: 'notifications', label: 'Уведомления', icon: Bell },
    { id: 'privacy', label: 'Приватность', icon: Lock },
    { id: 'appearance', label: 'Внешний вид', icon: Palette },
  ];

  return (
    <motion.div className={styles.container} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className={styles.header}>
        <h2 className={styles.title}>Настройки</h2>
        {saveSuccess && (
          <motion.div
            className={styles.successBadge}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
          >
            <Check size={16} />
            Сохранено
          </motion.div>
        )}
      </div>

      <div className={styles.content}>
        <div className={styles.sidebar}>
          {tabs.map((tab) => (
            <motion.button
              key={tab.id}
              className={`${styles.tab} ${activeTab === tab.id ? styles.activeTab : ''}`}
              onClick={() => setActiveTab(tab.id)}
              whileHover={{ x: 4 }}
              whileTap={{ scale: 0.98 }}
            >
              <tab.icon size={20} />
              <span>{tab.label}</span>
            </motion.button>
          ))}

          <div className={styles.divider} />

          <motion.button className={styles.logoutBtn} onClick={handleLogout} whileHover={{ x: 4 }} whileTap={{ scale: 0.98 }}>
            <LogOut size={20} />
            <span>Выйти</span>
          </motion.button>
        </div>

        <div className={styles.main}>
          {activeTab === 'profile' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={styles.section}>
              <h3 className={styles.sectionTitle}>Информация профиля</h3>

              <div className={styles.avatarSection}>
                <div className={styles.avatarWrapper}>
                  {avatarUrl ? (
                    <img src={`http://localhost:3000${avatarUrl}?v=${Date.now()}`} alt="Avatar" className={styles.avatarImage} />
                  ) : (
                    <div className={styles.avatarPlaceholder}>
                      <User size={48} />
                    </div>
                  )}
                  <motion.button
                    className={styles.avatarUploadBtn}
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Camera size={20} style={{ color: '#ffffff', stroke: '#ffffff', fill: 'none' }} />
                  </motion.button>
                  <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} />
                </div>
                <div className={styles.avatarInfo}>
                  <p className={styles.avatarTitle}>Фото профиля</p>
                  <p className={styles.avatarHint}>{uploadingAvatar ? 'Загрузка...' : 'Нажмите на камеру, чтобы изменить'}</p>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Отображаемое имя</label>
                <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={styles.input} />
              </div>

              <div className={styles.formGroup}>
                <label>Имя пользователя</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={styles.input}
                  placeholder="Установите имя пользователя"
                />
                <span className={styles.hint}>Уникальное имя для поиска</span>
              </div>

              <div className={styles.formGroup}>
                <label>О себе</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className={styles.textarea}
                  maxLength={160}
                  placeholder="Расскажите о себе"
                />
              </div>

              <motion.button
                className={styles.saveBtn}
                onClick={handleSaveProfile}
                disabled={loading}
                whileHover={{ scale: loading ? 1 : 1.02 }}
                whileTap={{ scale: loading ? 1 : 0.98 }}
              >
                <Save size={18} />
                {loading ? 'Сохранение...' : 'Сохранить изменения'}
              </motion.button>
            </motion.div>
          )}

          {activeTab === 'notifications' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={styles.section}>
              <h3 className={styles.sectionTitle}>Уведомления</h3>

              <div className={styles.settingItem}>
                <div className={styles.settingInfo}>
                  <Bell size={20} />
                  <div>
                    <div className={styles.settingLabel}>Все уведомления</div>
                    <div className={styles.settingDesc}>Получать уведомления о новых сообщениях</div>
                  </div>
                </div>
                <label className={styles.switch}>
                  <input
                    type="checkbox"
                    checked={settings.notifications}
                    onChange={(e) => setSettings({ ...settings, notifications: e.target.checked })}
                  />
                  <span className={styles.slider} />
                </label>
              </div>

              <div className={styles.settingItem}>
                <div className={styles.settingInfo}>
                  <Globe size={20} />
                  <div>
                    <div className={styles.settingLabel}>Звук уведомлений</div>
                    <div className={styles.settingDesc}>Воспроизводить звук при получении сообщения</div>
                  </div>
                </div>
                <label className={styles.switch}>
                  <input
                    type="checkbox"
                    checked={settings.notificationSound}
                    onChange={(e) => setSettings({ ...settings, notificationSound: e.target.checked })}
                  />
                  <span className={styles.slider} />
                </label>
              </div>

              <motion.button
                className={styles.saveBtn}
                onClick={handleSaveSettings}
                disabled={loading}
                whileHover={{ scale: loading ? 1 : 1.02 }}
                whileTap={{ scale: loading ? 1 : 0.98 }}
              >
                <Save size={18} />
                {loading ? 'Сохранение...' : 'Сохранить изменения'}
              </motion.button>
            </motion.div>
          )}

          {activeTab === 'privacy' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={styles.section}>
              <h3 className={styles.sectionTitle}>Приватность и безопасность</h3>

              <div className={styles.formGroup}>
                <label>Текущий пароль</label>
                <div className={styles.passwordInput}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className={styles.input}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className={styles.eyeBtn}>
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Новый пароль</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={styles.input} />
              </div>

              <div className={styles.settingItem}>
                <div className={styles.settingInfo}>
                  <Shield size={20} />
                  <div>
                    <div className={styles.settingLabel}>Двухфакторная аутентификация</div>
                    <div className={styles.settingDesc}>Дополнительная защита аккаунта</div>
                  </div>
                </div>
                <label className={styles.switch}>
                  <input
                    type="checkbox"
                    checked={settings.twoFactorAuth}
                    onChange={(e) => setSettings({ ...settings, twoFactorAuth: e.target.checked })}
                  />
                  <span className={styles.slider} />
                </label>
              </div>

              <motion.button
                className={styles.saveBtn}
                onClick={handleChangePassword}
                disabled={loading}
                whileHover={{ scale: loading ? 1 : 1.02 }}
                whileTap={{ scale: loading ? 1 : 0.98 }}
              >
                <Save size={18} />
                {loading ? 'Сохранение...' : 'Изменить пароль'}
              </motion.button>
            </motion.div>
          )}

          {activeTab === 'appearance' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={styles.section}>
              <h3 className={styles.sectionTitle}>Внешний вид</h3>

              <div className={styles.settingItem}>
                <div className={styles.settingInfo}>
                  {settings.darkMode ? <Moon size={20} /> : <Sun size={20} />}
                  <div>
                    <div className={styles.settingLabel}>Темная тема</div>
                    <div className={styles.settingDesc}>Использовать темное оформление</div>
                  </div>
                </div>
                <label className={styles.switch}>
                  <input
                    type="checkbox"
                    checked={settings.darkMode}
                    onChange={(e) => {
                      const darkMode = e.target.checked;
                      setSettings({ ...settings, darkMode });
                      setThemeFromDarkMode(darkMode);
                    }}
                  />
                  <span className={styles.slider} />
                </label>
              </div>

              <div className={styles.formGroup}>
                <label>Размер шрифта</label>
                <select
                  className={styles.select}
                  value={settings.fontSize}
                  onChange={(e) => setSettings({ ...settings, fontSize: e.target.value })}
                >
                  <option value="small">Маленький</option>
                  <option value="medium">Средний</option>
                  <option value="large">Большой</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label>Язык интерфейса</label>
                <select
                  className={styles.select}
                  value={settings.language}
                  onChange={(e) => setSettings({ ...settings, language: e.target.value })}
                >
                  <option value="ru">Русский</option>
                  <option value="en">English</option>
                  <option value="es">Español</option>
                </select>
              </div>

              <motion.button
                className={styles.saveBtn}
                onClick={handleSaveSettings}
                disabled={loading}
                whileHover={{ scale: loading ? 1 : 1.02 }}
                whileTap={{ scale: loading ? 1 : 0.98 }}
              >
                <Save size={18} />
                {loading ? 'Сохранение...' : 'Сохранить изменения'}
              </motion.button>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
