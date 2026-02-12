import { motion } from 'framer-motion';
import { User, Check, CheckCheck, Paperclip } from 'lucide-react';
import { useState } from 'react';
import { ImageViewer } from './ImageViewer';
import { chatIconById, getChatIconId } from '../utils/chatIcons';
import styles from './Message.module.css';

interface MessageProps {
  message: {
    id: string;
    content: string;
    senderId: string;
    senderName: string;
    senderAvatar?: string;
    createdAt: Date;
    isRead?: boolean;
  };
  isOwn: boolean;
  index: number;
}

export const Message = ({ message, isOwn, index }: MessageProps) => {
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [viewerImageUrl, setViewerImageUrl] = useState('');
  
  const time = new Date(message.createdAt).toLocaleTimeString('ru-RU', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  // Проверяем, является ли сообщение медиа
  const iconId = getChatIconId(message.content);
  const MessageIcon = iconId ? chatIconById[iconId] : null;

  const isMedia = !MessageIcon && (
    message.content.startsWith('[image]') ||
    message.content.startsWith('[video]') ||
    message.content.startsWith('[file]')
  );
  
  let mediaType = '';
  let mediaUrl = '';
  
  if (isMedia) {
    if (message.content.startsWith('[image]')) {
      mediaType = 'image';
      mediaUrl = message.content.replace('[image]', '');
    } else if (message.content.startsWith('[video]')) {
      mediaType = 'video';
      mediaUrl = message.content.replace('[video]', '');
    } else if (message.content.startsWith('[file]')) {
      mediaType = 'file';
      mediaUrl = message.content.replace('[file]', '');
    }
  }

  const handleImageClick = () => {
    if (mediaType === 'image') {
      setViewerImageUrl(`http://localhost:3000${mediaUrl}`);
      setImageViewerOpen(true);
    }
  };

  return (
    <motion.div
      className={`${styles.wrapper} ${isOwn ? styles.mine : ''}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      {!isOwn && (
        <div className={styles.avatar}>
          <User size={18} strokeWidth={1.5} />
        </div>
      )}
      
      <div className={`${styles.bubble} ${isOwn ? styles.mineBubble : ''}`}>
        {isMedia ? (
          <div className={styles.media}>
            {mediaType === 'image' && (
              <img 
                src={`http://localhost:3000${mediaUrl}`} 
                alt="Изображение" 
                className={styles.mediaImage}
                loading="lazy"
                onClick={handleImageClick}
                style={{ cursor: 'pointer' }}
              />
            )}
            {mediaType === 'video' && (
              <video 
                src={`http://localhost:3000${mediaUrl}`} 
                controls 
                className={styles.mediaVideo}
              />
            )}
            {mediaType === 'file' && (
              <a 
                href={`http://localhost:3000${mediaUrl}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className={styles.mediaFile}
              >
                <Paperclip size={15} strokeWidth={2.2} />
                <span>Файл</span>
              </a>
            )}
          </div>
        ) : MessageIcon ? (
          <div className={styles.iconMessage}>
            <MessageIcon size={22} strokeWidth={2.2} />
          </div>
        ) : (
          <p className={styles.text}>{message.content}</p>
        )}
        <div className={styles.footer}>
          <span className={styles.time}>{time}</span>
          {isOwn && (
            <span className={`${styles.readStatus} ${message.isRead ? styles.read : ''}`}>
              {message.isRead ? (
                <CheckCheck size={16} strokeWidth={2.5} />
              ) : (
                <Check size={16} strokeWidth={2.5} />
              )}
            </span>
          )}
        </div>
      </div>
      
      <ImageViewer
        key={`viewer-${message.id}`}
        isOpen={imageViewerOpen}
        imageUrl={viewerImageUrl}
        onClose={() => setImageViewerOpen(false)}
      />
    </motion.div>
  );
};
