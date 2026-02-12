import { Routes, Route } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { ChatsPage } from '../pages/ChatsPage';
import { FeedPage } from '../pages/FeedPage';
import { ProfilePage } from '../pages/ProfilePage';
import { SettingsPage } from '../pages/SettingsPage';
import { UserProfilePage } from '../pages/UserProfilePage';
import styles from './MainLayout.module.css';

export const MainLayout = () => {
  return (
    <div className={styles.container}>
      <Sidebar />
      <div className={styles.content}>
        <Routes>
          <Route path="/" element={<ChatsPage />} />
          <Route path="/chats" element={<ChatsPage />} />
          <Route path="/feed" element={<FeedPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/user/:userId" element={<UserProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </div>
    </div>
  );
};
