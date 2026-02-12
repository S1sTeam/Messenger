import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Heart, MessageCircle } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import styles from './UserProfilePage.module.css';

interface UserProfile {
  id: string;
  displayName: string;
  username: string;
  phone: string;
  bio: string;
  avatar: string;
}

interface FollowStatus {
  isFollowing: boolean;
  followersCount: number;
  followingCount: number;
}

interface UserPost {
  id: string;
  content: string;
  createdAt: string;
  likes: number;
  comments: number;
  reposts: number;
  isLiked: boolean;
  isReposted: boolean;
}

export const UserProfilePage = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const currentUser = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<UserPost[]>([]);
  const [followStatus, setFollowStatus] = useState<FollowStatus>({
    isFollowing: false,
    followersCount: 0,
    followingCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [updatingFollow, setUpdatingFollow] = useState(false);
  const [openingChat, setOpeningChat] = useState(false);

  useEffect(() => {
    if (!token || !userId) {
      return;
    }

    void loadUserProfile();
    void loadUserPosts();
    void loadFollowStatus();
  }, [token, userId]);

  const authHeaders: Record<string, string> | undefined = token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : undefined;

  const loadUserProfile = async () => {
    if (!userId) return;

    setLoading(true);
    try {
      const response = await fetch(`http://localhost:3000/api/users/${userId}`, {
        headers: authHeaders,
      });

      if (!response.ok) {
        return;
      }

      const data = await response.json();
      setProfile(data.user);
    } catch (error) {
      console.error('Failed to load user profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUserPosts = async () => {
    if (!userId) return;

    try {
      const response = await fetch(`http://localhost:3000/api/users/${userId}/posts`, {
        headers: authHeaders,
      });

      if (!response.ok) {
        return;
      }

      const data = await response.json();
      setPosts(data.posts || []);
    } catch (error) {
      console.error('Failed to load user posts:', error);
    }
  };

  const loadFollowStatus = async () => {
    if (!userId) return;

    try {
      const response = await fetch(`http://localhost:3000/api/users/${userId}/follow-status`, {
        headers: authHeaders,
      });

      if (!response.ok) {
        return;
      }

      const data = await response.json();
      setFollowStatus(data);
    } catch (error) {
      console.error('Failed to load follow status:', error);
    }
  };

  const handleFollow = async () => {
    if (!userId || updatingFollow) return;

    setUpdatingFollow(true);
    try {
      const response = await fetch(`http://localhost:3000/api/users/${userId}/follow`, {
        method: 'POST',
        headers: authHeaders,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        alert(data.error || 'Не удалось обновить подписку');
        return;
      }

      setFollowStatus((prev) => ({
        isFollowing: Boolean(data.isFollowing),
        followersCount:
          typeof data.followersCount === 'number'
            ? data.followersCount
            : prev.followersCount + (data.isFollowing ? 1 : -1),
        followingCount:
          typeof data.followingCount === 'number' ? data.followingCount : prev.followingCount,
      }));
    } catch (error) {
      console.error('Failed to follow/unfollow:', error);
      alert('Не удалось обновить подписку');
    } finally {
      setUpdatingFollow(false);
    }
  };

  const handleStartChat = async () => {
    if (!userId || !token || openingChat) return;

    setOpeningChat(true);
    try {
      const response = await fetch('http://localhost:3000/api/chats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.chat?.id) {
        alert(data.error || 'Не удалось открыть чат');
        return;
      }

      navigate(`/chats?chatId=${data.chat.id}`);
    } catch (error) {
      console.error('Failed to open direct chat:', error);
      alert('Не удалось открыть чат');
    } finally {
      setOpeningChat(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <p>Загрузка профиля...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className={styles.error}>
        <p>Пользователь не найден</p>
        <button onClick={() => navigate('/feed')}>Вернуться к ленте</button>
      </div>
    );
  }

  const firstLetter = profile.displayName?.charAt(0).toUpperCase() || 'U';
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52B788'];
  const colorIndex = firstLetter.charCodeAt(0) % colors.length;
  const avatarColor = colors[colorIndex];
  const isOwnProfile = currentUser?.id === userId;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/feed')}>
          <ArrowLeft size={24} />
        </button>
        <h2>Профиль</h2>
      </div>

      <div className={styles.profileHeader}>
        <div
          className={styles.avatar}
          style={{
            background: avatarColor,
            color: 'white',
            fontWeight: 700,
            fontSize: '48px',
          }}
        >
          {firstLetter}
        </div>
        <h1 className={styles.displayName}>{profile.displayName}</h1>
        <p className={styles.username}>@{profile.username || `user${profile.id.slice(0, 6)}`}</p>
        {profile.bio && <p className={styles.bio}>{profile.bio}</p>}

        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statValue}>{posts.length}</span>
            <span className={styles.statLabel}>Постов</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{followStatus.followersCount}</span>
            <span className={styles.statLabel}>Подписчики</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{followStatus.followingCount}</span>
            <span className={styles.statLabel}>Подписки</span>
          </div>
        </div>

        {!isOwnProfile && (
          <div className={styles.actions}>
            <motion.button
              className={`${styles.followBtn} ${followStatus.isFollowing ? styles.following : ''}`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleFollow}
              disabled={updatingFollow}
            >
              {followStatus.isFollowing ? 'Отписаться' : 'Подписаться'}
            </motion.button>
            <motion.button
              className={styles.messageBtn}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleStartChat}
              disabled={openingChat}
            >
              {openingChat ? 'Открываем...' : 'Написать в ЛС'}
            </motion.button>
          </div>
        )}
      </div>

      <div className={styles.postsSection}>
        <h3>Посты</h3>
        {posts.length === 0 ? (
          <div className={styles.noPosts}>
            <MessageCircle size={48} strokeWidth={1} />
            <p>Пока нет постов</p>
          </div>
        ) : (
          <div className={styles.posts}>
            {posts.map((post) => (
              <div key={post.id} className={styles.post}>
                <p className={styles.postContent}>{post.content}</p>
                <div className={styles.postFooter}>
                  <span>
                    <Heart size={16} fill={post.isLiked ? 'currentColor' : 'none'} style={{ color: post.isLiked ? '#f44336' : 'inherit' }} />
                    {post.likes}
                  </span>
                  <span>
                    <MessageCircle size={16} /> {post.comments}
                  </span>
                  <span className={styles.postDate}>{new Date(post.createdAt).toLocaleDateString('ru-RU')}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
