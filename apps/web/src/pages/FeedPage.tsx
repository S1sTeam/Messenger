import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, MessageCircle, Repeat2, Share, User, Loader, TrendingUp, Search } from 'lucide-react';
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
const TRENDING_TOPICS = [
  { tag: '#ИИ', posts: '125K' },
  { tag: '#Технологии', posts: '89K' },
  { tag: '#Программирование', posts: '67K' },
  { tag: '#Стартапы', posts: '45K' },
  { tag: '#Криптовалюта', posts: '34K' },
  { tag: '#Дизайн', posts: '28K' },
  { tag: '#Маркетинг', posts: '22K' },
  { tag: '#Бизнес', posts: '19K' },
];

export const FeedPage = () => {
  const navigate = useNavigate();
  const [newPostContent, setNewPostContent] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showComments, setShowComments] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
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

  // Фильтрация постов
  const filteredPosts = posts.filter(post => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'following') return false; // TODO: добавить логику подписок
    if (activeFilter === 'trending') return post.likes > 0; // Показываем посты с лайками
    return true;
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
    console.log('Клик на комментарии, postId:', postId);
    console.log('Текущий showComments:', showComments);
    
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
    if (!commentText.trim()) return;
    
    try {
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
          content: commentText,
          parentId: replyingTo?.commentId || null
        })
      });

      if (response.ok) {
        // Перезагружаем комментарии чтобы получить правильную структуру
        await loadComments(postId);
        setCommentText('');
        setReplyingTo(null);
        
        // Обновляем счётчик комментариев
        await loadPosts();
      }
    } catch (error) {
      console.error('Ошибка добавления комментария:', error);
      alert('Не удалось добавить комментарий');
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
          <h3 className={styles.sidebarTitle}>Темы</h3>
          <div className={styles.topicsList}>
            {TRENDING_TOPICS.map((topic, index) => (
              <motion.button
                key={index}
                className={styles.topicItem}
                whileHover={{ x: 4 }}
                onClick={() => {
                  setSearchQuery(topic.tag);
                  console.log('Поиск по теме:', topic.tag);
                }}
              >
                <TrendingUp size={16} />
                <div>
                  <div className={styles.topicTag}>{topic.tag}</div>
                  <div className={styles.topicCount}>{topic.posts} постов</div>
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
              <User size={24} />
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
                <span style={{ fontSize: '20px', color: '#999' }}>📎</span>
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
                  <span>📄 {selectedMedia?.name}</span>
                </div>
              )}
              <button 
                type="button" 
                className={styles.removeMediaBtn}
                onClick={removeMedia}
              >
                ✕
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
            filteredPosts.map((post, index) => (
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
                        : 'linear-gradient(135deg, var(--primary), var(--secondary))',
                      color: 'white',
                      fontWeight: 600,
                      fontSize: '14px',
                      cursor: 'pointer'
                    }}
                    onClick={() => navigate(`/user/${post.authorId}`)}
                  >
                    {post.authorName?.charAt(0).toUpperCase() || <User size={20} />}
                  </div>
                  <div className={styles.postInfo}>
                    <span 
                      className={styles.postAuthor}
                      onClick={() => navigate(`/user/${post.authorId}`)}
                      style={{ cursor: 'pointer' }}
                    >
                      {post.authorName}
                    </span>
                    <span className={styles.postTime}>
                      {new Date(post.createdAt).toLocaleDateString('ru-RU')}
                    </span>
                  </div>
                  {post.authorId === user?.id && (
                    <button
                      className={styles.deleteBtn}
                      onClick={() => deletePost(post.id)}
                    >
                      ×
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
                      <div className={styles.commentInput}>
                        {replyingTo?.postId === post.id && (
                          <div className={styles.replyingTo}>
                            Ответ для {replyingTo.authorName}
                            <button onClick={() => setReplyingTo(null)}>✕</button>
                          </div>
                        )}
                        <input
                          type="text"
                          placeholder={replyingTo?.postId === post.id ? `Ответить ${replyingTo.authorName}...` : "Написать комментарий..."}
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              handleAddComment(post.id);
                            }
                          }}
                        />
                        <button onClick={() => handleAddComment(post.id)}>
                          Отправить
                        </button>
                      </div>

                      {loadingComments[post.id] ? (
                        <div className={styles.commentsLoading}>
                          <Loader size={20} className={styles.spinner} />
                          <span>Загрузка комментариев...</span>
                        </div>
                      ) : (
                        <div className={styles.commentsList}>
                          {comments[post.id]?.map((comment) => {
                            const renderComment = (comment: any, level: number = 0): any => (
                              <div key={comment.id} className={styles.commentItem} style={{ marginLeft: level * 20 }}>
                                <div className={styles.commentAvatar}>
                                  <User size={16} />
                                </div>
                                <div className={styles.commentContent}>
                                  <div className={styles.commentHeader}>
                                    <span className={styles.commentAuthor}>{comment.authorName}</span>
                                    {comment.isPostAuthor && (
                                      <span className={styles.authorBadge}>Автор</span>
                                    )}
                                  </div>
                                  <div className={styles.commentText}>{comment.content}</div>
                                  <div className={styles.commentFooter}>
                                    <span className={styles.commentTime}>
                                      {new Date(comment.createdAt).toLocaleString('ru-RU')}
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
                            return renderComment(comment);
                          })}
                          {comments[post.id]?.length === 0 && (
                            <div className={styles.noComments}>Пока нет комментариев</div>
                          )}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))
          )}
        </div>
      </main>

      {/* Правая колонка - Поиск и рекомендации */}
      <aside className={styles.rightSidebar}>
        <div className={styles.searchBox}>
          <Search size={22} style={{ color: '#999', stroke: '#999', fill: 'none' }} />
          <input
            type="text"
            placeholder="Поиск..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className={styles.sidebarSection}>
          <h3 className={styles.sidebarTitle}>Популярные хештеги</h3>
          <div className={styles.hashtagsList}>
            {TRENDING_TOPICS.map((topic, index) => (
              <motion.button
                key={index}
                className={styles.hashtagItem}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSearchQuery(topic.tag)}
              >
                <span className={styles.hashtagTag}>{topic.tag}</span>
                <span className={styles.hashtagCount}>{topic.posts}</span>
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
          <h3 className={styles.sidebarTitle}>Активные пользователи</h3>
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
                      className={styles.followBtn}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFollowToggle(trendUser.id);
                      }}
                      style={{
                        background: followingUsers.has(trendUser.id) ? 'var(--bg-tertiary)' : 'var(--primary)'
                      }}
                    >
                      <span style={{ 
                        fontSize: '18px', 
                        fontWeight: 'bold', 
                        color: followingUsers.has(trendUser.id) ? '#999' : '#ffffff', 
                        lineHeight: '1' 
                      }}>
                        {followingUsers.has(trendUser.id) ? '✓' : '+'}
                      </span>
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
