import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, MessageCircle, Heart } from 'lucide-react';
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
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<UserPost[]>([]);
  const [followStatus, setFollowStatus] = useState<FollowStatus>({
    isFollowing: false,
    followersCount: 0,
    followingCount: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserProfile();
    loadUserPosts();
    loadFollowStatus();
  }, [userId]);

  const loadUserProfile = async () => {
    setLoading(true);
    try {
      const authStorage = localStorage.getItem('auth-storage');
      if (!authStorage) return;
      
      const { state } = JSON.parse(authStorage);
      const token = state?.token;
      
      if (!token) return;

      const response = await fetch(`http://localhost:3000/api/users/${userId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setProfile(data.user);
      }
    } catch (error) {
      console.error('Failed to load user profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUserPosts = async () => {
    try {
      const authStorage = localStorage.getItem('auth-storage');
      if (!authStorage) return;
      
      const { state } = JSON.parse(authStorage);
      const token = state?.token;
      
      if (!token) return;

      const response = await fetch(`http://localhost:3000/api/users/${userId}/posts`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setPosts(data.posts || []);
      }
    } catch (error) {
      console.error('Failed to load user posts:', error);
    }
  };

  const loadFollowStatus = async () => {
    try {
      const authStorage = localStorage.getItem('auth-storage');
      if (!authStorage) return;
      
      const { state } = JSON.parse(authStorage);
      const token = state?.token;
      
      if (!token) return;

      const response = await fetch(`http://localhost:3000/api/users/${userId}/follow-status`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setFollowStatus(data);
      }
    } catch (error) {
      console.error('Failed to load follow status:', error);
    }
  };

  const handleFollow = async () => {
    try {
      const authStorage = localStorage.getItem('auth-storage');
      if (!authStorage) return;
      
      const { state } = JSON.parse(authStorage);
      const token = state?.token;
      
      if (!token) return;

      const response = await fetch(`http://localhost:3000/api/users/${userId}/follow`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setFollowStatus(prev => ({
          ...prev,
          isFollowing: data.isFollowing,
          followersCount: prev.followersCount + (data.isFollowing ? 1 : -1)
        }));
      }
    } catch (error) {
      console.error('Failed to follow/unfollow:', error);
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
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
    '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52B788'
  ];
  const colorIndex = firstLetter.charCodeAt(0) % colors.length;
  const avatarColor = colors[colorIndex];

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
            fontSize: '48px'
          }}
        >
          {firstLetter}
        </div>
        <h1 className={styles.displayName}>{profile.displayName}</h1>
        <p className={styles.username}>
          @{profile.username || `user${profile.id.slice(0, 6)}`}
        </p>
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

        {currentUser?.id !== userId && (
          <motion.button
            className={`${styles.followBtn} ${followStatus.isFollowing ? styles.following : ''}`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleFollow}
          >
            {followStatus.isFollowing ? 'Отписаться' : 'Подписаться'}
          </motion.button>
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
                    <Heart 
                      size={16} 
                      fill={post.isLiked ? 'currentColor' : 'none'}
                      style={{ color: post.isLiked ? '#f44336' : 'inherit' }}
                    /> 
                    {post.likes}
                  </span>
                  <span><MessageCircle size={16} /> {post.comments}</span>
                  <span className={styles.postDate}>
                    {new Date(post.createdAt).toLocaleDateString('ru-RU')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
