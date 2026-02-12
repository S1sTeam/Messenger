import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  Briefcase,
  Check,
  Code2,
  FileText,
  Heart,
  Loader,
  MessageCircle,
  Palette,
  Paperclip,
  Plus,
  Repeat2,
  Rocket,
  Search,
  Share,
  ShieldCheck,
  User,
  X,
} from 'lucide-react';
import { useFeedStore } from '../store/feedStore';
import { useAuthStore } from '../store/authStore';
import { toBackendUrl } from '../config/network';
import styles from './FeedPage.module.css';

const FILTER_TABS = [
  { id: 'all', label: 'Все' },
  { id: 'following', label: 'Подписки' },
  { id: 'trending', label: 'Популярное' },
];

// Моковые данные известных людей для демонстрации функционала "Кого читать"
// В реальном приложении здесь будут данные из API
const DISCOVERY_STREAMS = [
  {
    id: 'product',
    title: 'Продукт и релизы',
    subtitle: 'Новые функции, интерфейс, UX',
    metric: '2.1k обсуждений',
    query: 'релиз обновление продукт',
    icon: Rocket,
  },
  {
    id: 'engineering',
    title: 'Инженерная практика',
    subtitle: 'Архитектура, код, оптимизация',
    metric: '1.7k обсуждений',
    query: 'архитектура код backend frontend',
    icon: Code2,
  },
  {
    id: 'design',
    title: 'Дизайн и контент',
    subtitle: 'Визуал, тексты, оформление',
    metric: '980 обсуждений',
    query: 'дизайн визуал контент',
    icon: Palette,
  },
  {
    id: 'growth',
    title: 'Бизнес и рост',
    subtitle: 'Монетизация, аналитика, продукт',
    metric: '760 обсуждений',
    query: 'бизнес рост аналитика',
    icon: Briefcase,
  },
];

const READING_COLLECTIONS = [
  {
    id: 'beginner',
    title: 'Для старта',
    description: 'Посты с базовыми объяснениями',
    query: 'основы гайд как начать',
    icon: BookOpen,
  },
  {
    id: 'quality',
    title: 'Практики качества',
    description: 'Тестирование, ревью, стабильность',
    query: 'тестирование review стабильность',
    icon: ShieldCheck,
  },
  {
    id: 'productivity',
    title: 'Командная эффективность',
    description: 'Процессы, договоренности, результат',
    query: 'команда процессы эффективность',
    icon: Briefcase,
  },
];

export const FeedPage = () => {
  const navigate = useNavigate();
  const [newPostContent, setNewPostContent] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showComments, setShowComments] = useState<string | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [submittingCommentFor, setSubmittingCommentFor] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, any[]>>({});
  const [loadingComments, setLoadingComments] = useState<Record<string, boolean>>({});
  const [replyingTo, setReplyingTo] = useState<{ postId: string; commentId: string | null; authorName: string } | null>(null);
  const [suggestedUsers, setSuggestedUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [followingUsers, setFollowingUsers] = useState<Set<string>>(new Set());
  const [selectedMedia, setSelectedMedia] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  
  const posts = useFeedStore((state) => state.posts);
  const loading = useFeedStore((state) => state.loading);
  const loadPosts = useFeedStore((state) => state.loadPosts);
  const createPost = useFeedStore((state) => state.createPost);
  const likePost = useFeedStore((state) => state.likePost);
  const repostPost = useFeedStore((state) => state.repostPost);
  const deletePost = useFeedStore((state) => state.deletePost);
  const user = useAuthStore((state) => state.user);
  const normalizedSearch = searchQuery.trim().toLowerCase();

  const resolveAvatarUrl = (avatar?: string | null) => {
    if (!avatar) return null;
    if (avatar.startsWith('http://') || avatar.startsWith('https://')) {
      return toBackendUrl(avatar);
    }
    if (avatar.startsWith('/')) {
      return toBackendUrl(avatar);
    }
    return null;
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'U';
    return parts.slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  };

  const getDisplayHandle = (username?: string, fallbackId?: string) => {
    if (username && username.trim()) {
      return `@${username.trim()}`;
    }
    return fallbackId ? `id:${fallbackId.slice(0, 6)}` : '@unknown';
  };

  const formatCommentTime = (value: Date) => {
    return new Date(value).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const updateCommentDraft = (postId: string, value: string) => {
    setCommentDrafts((prev) => ({
      ...prev,
      [postId]: value,
    }));
  };

  const currentUserAvatarUrl = resolveAvatarUrl(user?.avatar);
  const currentUserInitials = getInitials(user?.displayName || user?.username || 'me');

  // Фильтрация постов
  const filteredPosts = posts.filter(post => {
    if (activeFilter === 'following') return false; // TODO: добавить логику подписок
    if (activeFilter === 'trending' && post.likes === 0) return false;
    if (!normalizedSearch) return true;

    const authorText = `${post.authorName} ${post.authorUsername || ''}`.toLowerCase();
    const contentText = post.content.toLowerCase();
    return authorText.includes(normalizedSearch) || contentText.includes(normalizedSearch);
  });

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Поделиться постом',
          text: 'Посмотрите этот пост!',
          url: window.location.href
        });
      } else {
        // Копируем ссылку в буфер обмена
        await navigator.clipboard.writeText(window.location.href);
        alert('Ссылка скопирована в буфер обмена!');
      }
    } catch (error) {
      console.error('Ошибка при попытке поделиться:', error);
    }
  };

  const handleFollowToggle = async (userId: string) => {
    try {
      const authStorage = localStorage.getItem('auth-storage');
      if (!authStorage) return;
      
      const { state } = JSON.parse(authStorage);
      const token = state?.token;

      const response = await fetch(`http://localhost:3000/api/users/${userId}/follow`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setFollowingUsers(prev => {
          const newSet = new Set(prev);
          if (data.isFollowing) {
            newSet.add(userId);
          } else {
            newSet.delete(userId);
          }
          return newSet;
        });
      }
    } catch (error) {
      console.error('Ошибка подписки:', error);
    }
  };

  const loadComments = async (postId: string) => {
    try {
      setLoadingComments(prev => ({ ...prev, [postId]: true }));
      
      const authStorage = localStorage.getItem('auth-storage');
      if (!authStorage) return;
      
      const { state } = JSON.parse(authStorage);
      const token = state?.token;

      const response = await fetch(`http://localhost:3000/api/posts/${postId}/comments`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setComments(prev => ({ ...prev, [postId]: data.comments }));
      }
    } catch (error) {
      console.error('Ошибка загрузки комментариев:', error);
    } finally {
      setLoadingComments(prev => ({ ...prev, [postId]: false }));
    }
  };

  const handleComment = async (postId: string) => {
    if (showComments === postId) {
      setShowComments(null);
    } else {
      setShowComments(postId);
      if (!comments[postId]) {
        await loadComments(postId);
      }
    }
  };

  const handleAddComment = async (postId: string) => {
    const draft = (commentDrafts[postId] || '').trim();
    if (!draft || submittingCommentFor === postId) return;
    
    try {
      setSubmittingCommentFor(postId);
      const authStorage = localStorage.getItem('auth-storage');
      if (!authStorage) return;
      
      const { state } = JSON.parse(authStorage);
      const token = state?.token;

      const response = await fetch(`http://localhost:3000/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          content: draft,
          parentId: replyingTo?.commentId || null
        })
      });

      if (response.ok) {
        const data = await response.json();
        
        // Перезагружаем комментарии чтобы получить правильную структуру
        await loadComments(postId);
        setCommentDrafts((prev) => ({
          ...prev,
          [postId]: '',
        }));
        setReplyingTo(null);
        
        // Обновляем счётчик комментариев
        await loadPosts();
      }
    } catch (error) {
      console.error('Ошибка добавления комментария:', error);
      alert('Не удалось добавить комментарий');
    } finally {
      setSubmittingCommentFor((current) => (current === postId ? null : current));
    }
  };

  useEffect(() => {
    loadPosts();
    loadSuggestedUsers();
  }, []);

  const loadSuggestedUsers = async () => {
    setLoadingUsers(true);
    try {
      const authStorage = localStorage.getItem('auth-storage');
      if (!authStorage) return;
      
      const { state } = JSON.parse(authStorage);
      const token = state?.token;
      
      if (!token) return;

      const response = await fetch('http://localhost:3000/api/users/suggested/list', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSuggestedUsers(data.users || []);
        
        // Загружаем статус подписки для каждого пользователя
        const followStatuses = await Promise.all(
          data.users.map(async (user: any) => {
            const statusResponse = await fetch(`http://localhost:3000/api/users/${user.id}/follow-status`, {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });
            if (statusResponse.ok) {
              const statusData = await statusResponse.json();
              return { userId: user.id, isFollowing: statusData.isFollowing };
            }
            return { userId: user.id, isFollowing: false };
          })
        );
        
        // Обновляем состояние подписок
        const followingSet = new Set<string>();
        followStatuses.forEach(({ userId, isFollowing }) => {
          if (isFollowing) {
            followingSet.add(userId);
          }
        });
        setFollowingUsers(followingSet);
      }
    } catch (error) {
      console.error('Failed to load suggested users:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newPostContent.trim() && !selectedMedia) || isPosting) return;

    setIsPosting(true);
    try {
      let mediaUrl = '';
      
      // Загружаем медиа если есть
      if (selectedMedia) {
        const formData = new FormData();
        formData.append('file', selectedMedia);
        
        const authStorage = localStorage.getItem('auth-storage');
        if (!authStorage) return;
        
        const { state } = JSON.parse(authStorage);
        const token = state?.token;

        const uploadResponse = await fetch('http://localhost:3000/api/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });

        if (uploadResponse.ok) {
          const uploadData = await uploadResponse.json();
          mediaUrl = uploadData.url;
        } else {
          alert('Ошибка загрузки медиа');
          return;
        }
      }

      // Создаем пост с медиа
      await createPost(newPostContent, mediaUrl ? [mediaUrl] : []);
      setNewPostContent('');
      setSelectedMedia(null);
      setMediaPreview(null);
    } catch (error) {
      console.error('Failed to create post:', error);
    } finally {
      setIsPosting(false);
    }
  };

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Проверка размера (макс 100MB)
    if (file.size > 100 * 1024 * 1024) {
      alert('Файл слишком большой. Максимальный размер: 100MB');
      return;
    }

    setSelectedMedia(file);
    
    // Создаем превью для изображений и видео
    if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setMediaPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setMediaPreview(null);
    }
  };

  const removeMedia = () => {
    setSelectedMedia(null);
    setMediaPreview(null);
    if (mediaInputRef.current) {
      mediaInputRef.current.value = '';
    }
  };

  const charCount = newPostContent.length;
  const maxChars = 280;

  return (
    <div className={styles.container}>
      {/* Левая колонка - Фильтры */}
      <aside className={styles.leftSidebar}>
        <div className={styles.sidebarSection}>
          <h3 className={styles.sidebarTitle}>Фильтры</h3>
          <div className={styles.filterList}>
            {FILTER_TABS.map((tab) => (
              <motion.button
                key={tab.id}
                className={`${styles.filterBtn} ${activeFilter === tab.id ? styles.active : ''}`}
                onClick={() => setActiveFilter(tab.id)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {tab.label}
              </motion.button>
            ))}
          </div>
        </div>

        <div className={styles.sidebarSection}>
          <h3 className={styles.sidebarTitle}>Рубрики</h3>
          <div className={styles.streamsList}>
            {DISCOVERY_STREAMS.map((stream) => (
              <motion.button
                key={stream.id}
                className={styles.streamItem}
                whileHover={{ x: 4 }}
                onClick={() => {
                  setSearchQuery(stream.query);
                }}
              >
                <stream.icon size={16} />
                <div>
                  <div className={styles.streamTitle}>{stream.title}</div>
                  <div className={styles.streamSubtitle}>{stream.subtitle}</div>
                  <div className={styles.streamMeta}>{stream.metric}</div>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </aside>

      {/* Центральная колонка - Посты */}
      <main className={styles.mainFeed}>
        <div className={styles.header}>
          <h2 className={styles.title}>Лента</h2>
        </div>

        <form className={styles.newPost} onSubmit={handleCreatePost}>
          <div className={styles.newPostTop}>
            <div className={styles.avatar}>
              {currentUserAvatarUrl ? (
                <img src={currentUserAvatarUrl} alt={user?.displayName || 'Me'} className={styles.avatarImage} />
              ) : (
                currentUserInitials
              )}
            </div>
            <textarea
              placeholder="Что нового?"
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              className={styles.textarea}
              maxLength={maxChars}
              rows={3}
            />
          </div>
          
          <div className={styles.newPostBottom}>
            <div className={styles.postActions}>
              <input
                ref={mediaInputRef}
                type="file"
                accept="image/*,video/*"
                onChange={handleMediaSelect}
                style={{ display: 'none' }}
              />
              <button 
                type="button" 
                className={styles.iconBtn} 
                title="Добавить медиа"
                onClick={() => mediaInputRef.current?.click()}
              >
                <Paperclip size={20} />
              </button>
            </div>
            
            <div className={styles.postSubmit}>
              <span className={`${styles.charCount} ${charCount > maxChars ? styles.exceeded : ''}`}>
                {charCount}/{maxChars}
              </span>
              <motion.button
                type="submit"
                className={styles.postBtn}
                disabled={(!newPostContent.trim() && !selectedMedia) || isPosting || charCount > maxChars}
                whileHover={{ scale: (newPostContent.trim() || selectedMedia) ? 1.05 : 1 }}
                whileTap={{ scale: (newPostContent.trim() || selectedMedia) ? 0.95 : 1 }}
              >
                {isPosting ? <Loader size={18} className={styles.spinner} /> : 'Опубликовать'}
              </motion.button>
            </div>
          </div>

          {mediaPreview && (
            <div className={styles.mediaPreview}>
              {selectedMedia?.type.startsWith('image/') ? (
                <img src={mediaPreview} alt="Preview" />
              ) : selectedMedia?.type.startsWith('video/') ? (
                <video src={mediaPreview} controls />
              ) : (
                <div className={styles.filePreview}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <FileText size={16} />
                    {selectedMedia?.name}
                  </span>
                </div>
              )}
              <button 
                type="button" 
                className={styles.removeMediaBtn}
                onClick={removeMedia}
              >
                <X size={16} />
              </button>
            </div>
          )}
        </form>

        <div className={styles.posts}>
          {loading && filteredPosts.length === 0 ? (
            <div className={styles.loading}>
              <Loader size={32} className={styles.spinner} />
              <p>Загрузка постов...</p>
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className={styles.empty}>
              <MessageCircle size={64} strokeWidth={1} />
              <p>Нет постов</p>
              <span>Будьте первым, кто создаст пост!</span>
            </div>
          ) : (
            filteredPosts.map((post, index) => {
              const authorAvatarUrl = resolveAvatarUrl(post.authorAvatar);
              const authorHandle = getDisplayHandle(post.authorUsername, post.authorId);
              const postComments = comments[post.id] || [];
              const commentDraft = commentDrafts[post.id] || '';

              return (
                <motion.div
                  key={post.id}
                  className={styles.post}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                <div className={styles.postHeader}>
                  <div 
                    className={styles.postAvatar}
                    style={{
                      background: post.authorName 
                        ? ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8'][post.authorName.charCodeAt(0) % 5]
                        : 'linear-gradient(135deg, var(--primary), var(--avatar-gradient-end))',
                      color: 'white',
                      fontWeight: 600,
                      fontSize: '14px',
                      cursor: 'pointer'
                    }}
                    onClick={() => navigate(`/user/${post.authorId}`)}
                  >
                    {authorAvatarUrl ? (
                      <img src={authorAvatarUrl} alt={post.authorName} className={styles.postAvatarImage} />
                    ) : (
                      getInitials(post.authorName || '')
                    )}
                  </div>
                  <div className={styles.postInfo}>
                    <span 
                      className={styles.postAuthor}
                      onClick={() => navigate(`/user/${post.authorId}`)}
                      style={{ cursor: 'pointer' }}
                    >
                      {post.authorName}
                    </span>
                    <div className={styles.postMetaRow}>
                      <span className={styles.postHandle}>{authorHandle}</span>
                      <span className={styles.postMetaDot}>•</span>
                      <span className={styles.postTime}>
                        {new Date(post.createdAt).toLocaleDateString('ru-RU')}
                      </span>
                    </div>
                  </div>
                  {post.authorId === user?.id && (
                    <button
                      className={styles.deleteBtn}
                      onClick={() => deletePost(post.id)}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <p className={styles.postContent}>{post.content}</p>

                {post.images && post.images.length > 0 && (
                  <div className={styles.postMedia}>
                    {post.images.map((image, idx) => {
                      const isVideo = image.match(/\.(mp4|mov|avi|mkv)$/i);
                      return isVideo ? (
                        <video key={idx} src={toBackendUrl(image)} controls className={styles.postVideo} />
                      ) : (
                        <img key={idx} src={toBackendUrl(image)} alt="Post media" className={styles.postImage} />
                      );
                    })}
                  </div>
                )}

                <div className={styles.postActions}>
                  <motion.button
                    className={`${styles.actionBtn} ${post.isLiked ? styles.liked : ''}`}
                    onClick={() => likePost(post.id)}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    title="Нравится"
                  >
                    <Heart size={18} fill={post.isLiked ? 'currentColor' : 'none'} />
                    <span>{post.likes}</span>
                  </motion.button>

                  <motion.button
                    className={styles.actionBtn}
                    onClick={() => handleComment(post.id)}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    title="Комментировать"
                  >
                    <MessageCircle size={18} />
                    <span>{post.comments}</span>
                  </motion.button>

                  <motion.button
                    className={`${styles.actionBtn} ${post.isReposted ? styles.reposted : ''}`}
                    onClick={() => repostPost(post.id)}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    title="Репост"
                  >
                    <Repeat2 size={18} />
                    <span>{post.reposts}</span>
                  </motion.button>

                  <motion.button
                    className={styles.actionBtn}
                    onClick={() => handleShare()}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    title="Поделиться"
                  >
                    <Share size={18} />
                  </motion.button>
                </div>

                <AnimatePresence>
                  {showComments === post.id && (
                    <motion.div
                      className={styles.commentSection}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <div className={styles.commentSectionHeader}>
                        <span>Обсуждение</span>
                        <span>{postComments.length || post.comments} комментариев</span>
                      </div>

                      <div className={styles.commentInput}>
                        {replyingTo?.postId === post.id && (
                          <div className={styles.replyingTo}>
                            Ответ для {replyingTo.authorName}
                            <button onClick={() => setReplyingTo(null)}>
                              <X size={12} />
                            </button>
                          </div>
                        )}
                        <input
                          type="text"
                          placeholder={replyingTo?.postId === post.id ? `Ответить ${replyingTo.authorName}...` : "Написать комментарий..."}
                          value={commentDraft}
                          onChange={(e) => updateCommentDraft(post.id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddComment(post.id);
                            }
                          }}
                        />
                        <button
                          onClick={() => handleAddComment(post.id)}
                          disabled={!commentDraft.trim() || submittingCommentFor === post.id}
                        >
                          {submittingCommentFor === post.id ? 'Отправка...' : 'Отправить'}
                        </button>
                      </div>

                      {loadingComments[post.id] ? (
                        <div className={styles.commentsLoading}>
                          <Loader size={20} className={styles.spinner} />
                          <span>Загрузка комментариев...</span>
                        </div>
                      ) : (
                        <div className={styles.commentsList}>
                          {postComments.map((comment) => {
                            const renderComment = (comment: any, level: number = 0): any => {
                              const commentAvatarUrl = resolveAvatarUrl(comment.authorAvatar);

                              return (
                                <div
                                  key={comment.id}
                                  className={styles.commentItem}
                                  style={{ marginLeft: Math.min(level * 16, 32) }}
                                >
                                  <div className={styles.commentAvatar}>
                                    {commentAvatarUrl ? (
                                      <img
                                        src={commentAvatarUrl}
                                        alt={comment.authorName}
                                        className={styles.commentAvatarImage}
                                      />
                                    ) : (
                                      getInitials(comment.authorName || '')
                                    )}
                                  </div>
                                <div className={styles.commentContent}>
                                  <div className={styles.commentHeader}>
                                    <span className={styles.commentAuthor}>{comment.authorName}</span>
                                    <span className={styles.commentHandle}>
                                      {getDisplayHandle(comment.authorUsername, comment.authorId)}
                                    </span>
                                    {comment.isPostAuthor && (
                                      <span className={styles.authorBadge}>Автор</span>
                                    )}
                                  </div>
                                  <div className={styles.commentText}>{comment.content}</div>
                                  <div className={styles.commentFooter}>
                                    <span className={styles.commentTime}>
                                      {formatCommentTime(comment.createdAt)}
                                    </span>
                                    <button 
                                      className={styles.replyBtn}
                                      onClick={() => setReplyingTo({ 
                                        postId: post.id, 
                                        commentId: comment.id, 
                                        authorName: comment.authorName 
                                      })}
                                    >
                                      Ответить
                                    </button>
                                  </div>
                                  {comment.replies && comment.replies.length > 0 && (
                                    <div className={styles.replies}>
                                      {comment.replies.map((reply: any) => renderComment(reply, level + 1))}
                                    </div>
                                  )}
                                </div>
                              </div>
                              );
                            };
                            return renderComment(comment);
                          })}
                          {postComments.length === 0 && (
                            <div className={styles.noComments}>Пока нет комментариев</div>
                          )}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
              );
            })
          )}
        </div>
      </main>

      {/* Правая колонка - Поиск и рекомендации */}
      <aside className={styles.rightSidebar}>
        <div className={styles.searchBox}>
          <Search
            size={22}
            style={{ color: 'var(--text-tertiary)', stroke: 'var(--text-tertiary)', fill: 'none' }}
          />
          <input
            type="text"
            placeholder="Поиск по авторам и постам..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className={styles.sidebarSection}>
          <h3 className={styles.sidebarTitle}>Что почитать</h3>
          <div className={styles.collectionsList}>
            {READING_COLLECTIONS.map((collection) => (
              <motion.button
                key={collection.id}
                className={styles.collectionItem}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSearchQuery(collection.query)}
              >
                <collection.icon size={16} />
                <div>
                  <div className={styles.collectionTitle}>{collection.title}</div>
                  <div className={styles.collectionDesc}>{collection.description}</div>
                </div>
              </motion.button>
            ))}
          </div>
        </div>

        <div className={styles.sidebarSection}>
          <h3 className={styles.sidebarTitle}>Статистика платформы</h3>
          <div className={styles.statsCard}>
            <div className={styles.statItem}>
              <User size={20} />
              <div>
                <div className={styles.statValue}>{suggestedUsers.length + 1}</div>
                <div className={styles.statLabel}>Пользователей</div>
              </div>
            </div>
            <div className={styles.statItem}>
              <MessageCircle size={20} />
              <div>
                <div className={styles.statValue}>{posts.length}</div>
                <div className={styles.statLabel}>Постов</div>
              </div>
            </div>
            <div className={styles.statItem}>
              <Heart size={20} />
              <div>
                <div className={styles.statValue}>
                  {posts.reduce((sum, post) => sum + post.likes, 0)}
                </div>
                <div className={styles.statLabel}>Лайков</div>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.sidebarSection}>
          <h3 className={styles.sidebarTitle}>Аккаунты для вас</h3>
          {loadingUsers ? (
            <div className={styles.loading}>
              <Loader size={24} className={styles.spinner} />
            </div>
          ) : (
            <div className={styles.usersList}>
              {suggestedUsers.map((trendUser) => {
                const firstLetter = trendUser.displayName?.charAt(0).toUpperCase() || 'U';
                const colors = [
                  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
                  '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52B788'
                ];
                const colorIndex = firstLetter.charCodeAt(0) % colors.length;
                const avatarColor = colors[colorIndex];
                
                return (
                  <motion.div
                    key={trendUser.id}
                    className={styles.userItem}
                    whileHover={{ backgroundColor: 'var(--bg-hover)' }}
                    onClick={() => navigate(`/user/${trendUser.id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div 
                      className={styles.userAvatar}
                      style={{ 
                        background: avatarColor,
                        color: 'white',
                        fontWeight: 600,
                        fontSize: '20px'
                      }}
                    >
                      {firstLetter}
                    </div>
                    <div className={styles.userInfo}>
                      <div className={styles.userName}>{trendUser.displayName}</div>
                      <div className={styles.userUsername}>
                        @{trendUser.username || `user${trendUser.id.slice(0, 6)}`}
                      </div>
                      <div className={styles.userFollowers}>{trendUser._count?.posts || 0} постов</div>
                    </div>
                    <motion.button
                      className={`${styles.followBtn} ${followingUsers.has(trendUser.id) ? styles.following : ''}`}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFollowToggle(trendUser.id);
                      }}
                    >
                      {followingUsers.has(trendUser.id) ? (
                        <>
                          <Check size={14} />
                          Вы подписаны
                        </>
                      ) : (
                        <>
                          <Plus size={14} />
                          Подписаться
                        </>
                      )}
                    </motion.button>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
};

