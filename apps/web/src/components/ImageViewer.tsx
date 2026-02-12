import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ZoomIn, ZoomOut, Download } from 'lucide-react';
import styles from './ImageViewer.module.css';

interface ImageViewerProps {
  isOpen: boolean;
  imageUrl: string;
  onClose: () => void;
}

export const ImageViewer = ({ isOpen, imageUrl, onClose }: ImageViewerProps) => {
  const [zoom, setZoom] = useState(1);

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.5, 3));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.5, 0.5));
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = 'image.jpg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className={styles.overlay}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleBackdropClick}
      >
        <motion.div
          className={styles.container}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
        >
          {/* Панель управления */}
          <div className={styles.controls}>
            {/* Кнопка уменьшить */}
            <button
              className={styles.controlBtn}
              onClick={handleZoomOut}
              title="Уменьшить"
            >
              <ZoomOut size={22} />
            </button>

            {/* Уровень зума */}
            <span className={styles.zoomLevel}>{Math.round(zoom * 100)}%</span>

            {/* Кнопка увеличить */}
            <button
              className={styles.controlBtn}
              onClick={handleZoomIn}
              title="Увеличить"
            >
              <ZoomIn size={22} />
            </button>

            {/* Кнопка скачать */}
            <button
              className={styles.controlBtn}
              onClick={handleDownload}
              title="Скачать"
            >
              <Download size={22} />
            </button>

            {/* Кнопка закрыть */}
            <button
              className={`${styles.controlBtn} ${styles.closeBtn}`}
              onClick={onClose}
              title="Закрыть"
            >
              <X size={26} />
            </button>
          </div>

          {/* Изображение */}
          <div className={styles.imageWrapper}>
            <motion.img
              src={imageUrl}
              alt="Preview"
              className={styles.image}
              style={{ transform: `scale(${zoom})` }}
              drag
              dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
              dragElastic={0.1}
            />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
