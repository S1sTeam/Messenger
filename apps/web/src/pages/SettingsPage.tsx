import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  User, Bell, Lock, Palette, Globe, Moon, Sun, 
  Shield, Eye, EyeOff, Save, LogOut, Check, Camera 
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import { toBackendUrl } from '../config/network';
import styles from './SettingsPage.module.css';

interface UserSettings {
  notifications: boolean;
  notificationSound: boolean;
  darkMode: boolean;
  fontSize: string;
  language: string;
  twoFactorAuth: boolean;
}

export const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState('profile');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  
  // Profile
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  
  // Password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  // Settings
  const [settings, setSettings] = useState<UserSettings>({
    notifications: true,
    notificationSound: true,
    darkMode: true,
    fontSize: 'medium',
    language: 'ru',
    twoFactorAuth: false
  });
  
  const token = useAuthStore((state) => state.token);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/settings', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setDisplayName(data.user.displayName || '');
        setUsername(data.user.username || '');
        setBio(data.user.bio || '');
        setAvatarUrl(data.user.avatar || '');
        setSettings(data.settings);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const handleSaveProfile = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:3000/api/settings/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ username, displayName, bio })
      });

      if (response.ok) {
        showSuccessMessage();
      } else {
        const error = await response.json();
        alert(error.error || 'Ошибка сохранения');
      }
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

    console.log('📤 Uploading avatar:', file.name, file.type, file.size);

    // Проверка типа файла
    if (!file.type.startsWith('image/')) {
      alert('Пожалуйста, выберите изображение');
      return;
    }

    // Проверка размера (макс 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Файл слишком большой. Максимальный размер: 5MB');
      return;
    }

    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      console.log('📡 Sending upload request...');

      const uploadResponse = await fetch('http://localhost:3000/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      console.log('📥 Upload response status:', uploadResponse.status);

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        console.error('❌ Upload failed:', errorData);
        throw new Error(errorData.error || 'Ошибка загрузки файла');
      }

      const uploadData = await uploadResponse.json();
      console.log('✅ File uploaded:', uploadData);
      
      // Обновляем аватар в профиле
      console.log('📡 Updating avatar in profile...');
      const updateResponse = await fetch('http://localhost:3000/api/settings/avatar', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ avatar: uploadData.url })
      });

      console.log('📥 Update response status:', updateResponse.status);

      if (updateResponse.ok) {
        const userData = await updateResponse.json();
        setAvatarUrl(uploadData.url);
        
        // Обновляем пользователя в authStore
        const setUser = useAuthStore.getState().setUser;
        const currentToken = useAuthStore.getState().token;
        if (currentToken) {
          setUser({
            ...userData.user
          }, currentToken);
        }
        
        showSuccessMessage();
        console.log('✅ Avatar updated successfully');
      } else {
        const errorData = await updateResponse.json();
        console.error('❌ Update failed:', errorData);
        throw new Error(errorData.error || 'Ошибка обновления аватара');
      }
    } catch (error) {
      console.error('❌ Avatar upload error:', error);
      alert(`Не удалось загрузить аватар: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) {
        avatarInputRef.current.value = '';
      }
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      alert('Заполните все поля');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('http://localhost:3000/api/settings/password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });

      if (response.ok) {
        setCurrentPassword('');
        setNewPassword('');
        showSuccessMessage();
      } else {
        const error = await response.json();
        alert(error.error || 'Ошибка изменения пароля');
      }
    } catch (error) {
      console.error('Failed to change password:', error);
      alert('Ошибка изменения пароля');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:3000/api/settings/preferences', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(settings)
      });

      if (response.ok) {
        showSuccessMessage();
      } else {
        alert('Ошибка сохранения настроек');
      }
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
    <motion.div 
      className={styles.container}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
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
          
          <motion.button
            className={styles.logoutBtn}
            onClick={handleLogout}
            whileHover={{ x: 4 }}
            whileTap={{ scale: 0.98 }}
          >
            <LogOut size={20} />
            <span>Выйти</span>
          </motion.button>
        </div>

        <div className={styles.main}>
          {activeTab === 'profile' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={styles.section}
            >
              <h3 className={styles.sectionTitle}>Информация профиля</h3>
              
              {/* Аватар */}
              <div className={styles.avatarSection}>
                <div className={styles.avatarWrapper}>
                  {avatarUrl ? (
                    <img 
                      src={`${toBackendUrl(avatarUrl)}?v=${Date.now()}`} 
                      alt="Avatar" 
                      className={styles.avatarImage}
                    />
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
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    style={{ display: 'none' }}
                  />
                </div>
                <div className={styles.avatarInfo}>
                  <p className={styles.avatarTitle}>Фото профиля</p>
                  <p className={styles.avatarHint}>
                    {uploadingAvatar ? 'Загрузка...' : 'Нажмите на камеру чтобы изменить'}
                  </p>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Отображаемое имя</label>
                <input 
                  type="text" 
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className={styles.input}
                />
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
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={styles.section}
            >
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
                    onChange={(e) => setSettings({...settings, notifications: e.target.checked})}
                  />
                  <span className={styles.slider}></span>
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
                    onChange={(e) => setSettings({...settings, notificationSound: e.target.checked})}
                  />
                  <span className={styles.slider}></span>
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
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={styles.section}
            >
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
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={styles.eyeBtn}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Новый пароль</label>
                <input 
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={styles.input}
                />
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
                    onChange={(e) => setSettings({...settings, twoFactorAuth: e.target.checked})}
                  />
                  <span className={styles.slider}></span>
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
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={styles.section}
            >
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
                    onChange={(e) => setSettings({...settings, darkMode: e.target.checked})}
                  />
                  <span className={styles.slider}></span>
                </label>
              </div>

              <div className={styles.formGroup}>
                <label>Размер шрифта</label>
                <select 
                  className={styles.select}
                  value={settings.fontSize}
                  onChange={(e) => setSettings({...settings, fontSize: e.target.value})}
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
                  onChange={(e) => setSettings({...settings, language: e.target.value})}
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
