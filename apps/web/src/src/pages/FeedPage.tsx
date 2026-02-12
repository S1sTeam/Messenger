import { motion } from 'framer-motion';
import { Heart, MessageCircle, Repeat2, Share } from 'lucide-react';
import styles from './FeedPage.module.css';

const mockPosts = [
  { id: '1', author: 'Алексей', avatar: '👨', text: 'Запустил новый проект! 🚀', likes: 24, comments: 5, time: '2 часа назад' },
  { id: '2', author: 'Мария', avatar: '👩', text: 'Отличная погода сегодня ☀️', likes: 15, comments: 3, time: '4 часа назад' },
];

export const FeedPage = () => {
  return (
    <motion.div 
      className={styles.container}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className={styles.header}>
        <h2 className={styles.title}>Лента</h2>
      </div>

      <div className={styles.newPost}>
        <div className={styles.avatar}>👤</div>
        <textarea 
          placeholder="Что нового?"
          className={styles.textarea}
        />
        <motion.button
          className={styles.postBtn}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Опубликовать
        </motion.button>
      </div>

      <div className={styles.feed}>
        {mockPosts.map((post, index) => (
          <motion.div
            key={post.id}
            className={styles.post}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <div className={styles.postHeader}>
              <div className={styles.avatar}>{post.avatar}</div>
              <div>
                <div className={styles.author}>{post.author}</div>
                <div className={styles.time}>{post.time}</div>
              </div>
            </div>
            
            <p className={styles.postText}>{post.text}</p>
            
            <div className={styles.actions}>
              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                <Heart size={18} />
                <span>{post.likes}</span>
              </motion.button>
              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                <MessageCircle size={18} />
                <span>{post.comments}</span>
              </motion.button>
              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                <Repeat2 size={18} />
              </motion.button>
              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                <Share size={18} />
              </motion.button>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};
