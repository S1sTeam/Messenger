import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, Copy, Edit3, FileText, Hash, Phone, RefreshCw, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toBackendUrl } from '../config/network';
import { useAuthStore } from '../store/authStore';
import styles from './ProfilePage.module.css';

interface SettingsUserPayload {
  id: string;
  phone: string;
  username?: string | null;
  displayName: string;
  avatar?: string | null;
  bio?: string | null;
  createdAt?: string;
}

interface FollowStatusPayload {
  isFollowing: boolean;
  followersCount: number;
  followingCount: number;
}

interface UserPostPayload {
  id: string;
  content: string;
  createdAt: string;
  likes: number;
  comments: number;
  reposts: number;
}

const formatDate = (value?: string) => {
  if (!value) return 'Недавно';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Недавно';

  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(parsed);
};

export const ProfilePage = () => {
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);
  const authUser = useAuthStore((state) => state.user);

  const [profile, setProfile] = useState<SettingsUserPayload | null>(null);
  const [followStatus, setFollowStatus] = useState<FollowStatusPayload>({
    isFollowing: false,
    followersCount: 0,
    followingCount: 0,
  });
  const [postsCount, setPostsCount] = useState(0);
  const [recentPosts, setRecentPosts] = useState<UserPostPayload[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fallbackProfile = useMemo<SettingsUserPayload | null>(() => {
    if (!authUser) return null;

    return {
      id: authUser.id,
      phone: authUser.phone,
      username: authUser.username ?? null,
      displayName: authUser.displayName,
      avatar: authUser.avatar ?? null,
      bio: null,
    };
  }, [authUser]);

  const resolvedProfile = profile ?? fallbackProfile;

  const profileHandle = useMemo(() => {
    if (!resolvedProfile) return '@user';

    const username = resolvedProfile.username?.trim();
    if (username) return `@${username}`;

    return `@user${resolvedProfile.id.slice(0, 6)}`;
  }, [resolvedProfile]);

  const avatarUrl = useMemo(() => {
    if (!resolvedProfile?.avatar) return null;
    return toBackendUrl(resolvedProfile.avatar);
  }, [resolvedProfile?.avatar]);

  const profileInitial = useMemo(() => {
    const source = resolvedProfile?.displayName?.trim() || resolvedProfile?.username?.trim() || 'U';
    return source.charAt(0).toUpperCase();
  }, [resolvedProfile?.displayName, resolvedProfile?.username]);

  const shareLink = useMemo(() => {
    if (!resolvedProfile) return '';
    const username = resolvedProfile.username?.trim();
    return username ? `messenger://user/${username}` : `messenger://id/${resolvedProfile.id}`;
  }, [resolvedProfile]);

  const loadProfile = async () => {
    if (!token || !authUser?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const headers = {
      Authorization: `Bearer ${token}`,
    };

    const [settingsResult, followResult, postsResult] = await Promise.allSettled([
      fetch(toBackendUrl('/api/settings'), { headers }).then(async (response) => {
        if (!response.ok) {
          throw new Error(`Settings request failed: ${response.status}`);
        }
        return (await response.json()) as { user?: SettingsUserPayload };
      }),
      fetch(toBackendUrl(`/api/users/${authUser.id}/follow-status`), { headers }).then(async (response) => {
        if (!response.ok) {
          throw new Error(`Follow status failed: ${response.status}`);
        }
        return (await response.json()) as FollowStatusPayload;
      }),
      fetch(toBackendUrl(`/api/users/${authUser.id}/posts`), { headers }).then(async (response) => {
        if (!response.ok) {
          throw new Error(`Posts request failed: ${response.status}`);
        }
        return (await response.json()) as { posts?: UserPostPayload[] };
      }),
    ]);

    if (settingsResult.status === 'fulfilled') {
      setProfile(settingsResult.value.user ?? null);
    } else {
      console.error('Failed to load profile settings:', settingsResult.reason);
      setError('Не удалось загрузить профиль. Проверьте соединение с сервером.');
    }

    if (followResult.status === 'fulfilled') {
      setFollowStatus(followResult.value);
    } else {
      console.error('Failed to load follow counters:', followResult.reason);
    }

    if (postsResult.status === 'fulfilled') {
      const posts = Array.isArray(postsResult.value.posts) ? postsResult.value.posts : [];
      setPostsCount(posts.length);
      setRecentPosts(posts.slice(0, 3));
    } else {
      console.error('Failed to load own posts:', postsResult.reason);
      setPostsCount(0);
      setRecentPosts([]);
    }

    setLoading(false);
  };

  useEffect(() => {
    void loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, authUser?.id]);

  const handleCopyLink = async () => {
    if (!shareLink) return;

    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (copyError) {
      console.error('Failed to copy profile link:', copyError);
      alert('Не удалось скопировать ссылку');
    }
  };

  if (!resolvedProfile) {
    return (
      <div className={styles.container}>
        <div className={styles.errorCard}>
          <h3>Профиль недоступен</h3>
          <p>Войдите в аккаунт, чтобы открыть страницу профиля.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Профиль</h2>
        <button className={styles.reloadBtn} onClick={() => void loadProfile()} disabled={loading}>
          <RefreshCw size={16} className={loading ? styles.spin : undefined} />
          Обновить
        </button>
      </div>

      {error && <div className={styles.inlineError}>{error}</div>}

      <div className={styles.content}>
        <motion.section className={styles.card} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div className={styles.avatarSection}>
            <div className={styles.avatarLarge}>
              {avatarUrl ? (
                <img src={avatarUrl} alt={resolvedProfile.displayName} className={styles.avatarImage} />
              ) : (
                <span className={styles.avatarInitial}>{profileInitial}</span>
              )}
            </div>
            <button className={styles.editBtn} onClick={() => navigate('/settings')}>
              <Edit3 size={14} />
              Редактировать
            </button>
          </div>

          <div className={styles.info}>
            <h3 className={styles.name}>{resolvedProfile.displayName}</h3>
            <p className={styles.username}>{profileHandle}</p>
            <p className={styles.bio}>
              {resolvedProfile.bio?.trim() ? resolvedProfile.bio : 'Пока без описания. Добавьте пару слов о себе в настройках.'}
            </p>
          </div>

          <div className={styles.stats}>
            <div className={styles.stat}>
              <div className={styles.statValue}>{postsCount}</div>
              <div className={styles.statLabel}>Посты</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statValue}>{followStatus.followersCount}</div>
              <div className={styles.statLabel}>Подписчики</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statValue}>{followStatus.followingCount}</div>
              <div className={styles.statLabel}>Подписки</div>
            </div>
          </div>

          <div className={styles.details}>
            <div className={styles.detail}>
              <UserRound size={16} />
              <span className={styles.detailLabel}>Ник</span>
              <span className={styles.detailValue}>{resolvedProfile.displayName}</span>
            </div>
            <div className={styles.detail}>
              <Hash size={16} />
              <span className={styles.detailLabel}>Username</span>
              <span className={styles.detailValue}>{profileHandle}</span>
            </div>
            <div className={styles.detail}>
              <Phone size={16} />
              <span className={styles.detailLabel}>Телефон</span>
              <span className={styles.detailValue}>{resolvedProfile.phone}</span>
            </div>
            <div className={styles.detail}>
              <CalendarDays size={16} />
              <span className={styles.detailLabel}>В профиле с</span>
              <span className={styles.detailValue}>{formatDate(resolvedProfile.createdAt)}</span>
            </div>
          </div>

          <div className={styles.actions}>
            <button className={styles.editProfileBtn} onClick={() => navigate('/settings')}>
              <Edit3 size={16} />
              Открыть настройки
            </button>
            <button className={styles.shareBtn} onClick={handleCopyLink}>
              <Copy size={16} />
              {copied ? 'Ссылка скопирована' : 'Скопировать ссылку'}
            </button>
          </div>
        </motion.section>

        <motion.section
          className={styles.card}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04 }}
        >
          <h4 className={styles.sectionTitle}>Последние публикации</h4>
          {recentPosts.length === 0 ? (
            <div className={styles.emptyState}>
              <FileText size={18} />
              Публикаций пока нет
            </div>
          ) : (
            <div className={styles.activityList}>
              {recentPosts.map((post) => (
                <div key={post.id} className={styles.activityItem}>
                  <div className={styles.activityContent}>
                    <p className={styles.activityValue}>{post.content}</p>
                    <p className={styles.activityTitle}>
                      {formatDate(post.createdAt)} • ❤ {post.likes} • 💬 {post.comments} • ↻ {post.reposts}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.section>
      </div>
    </div>
  );
};
