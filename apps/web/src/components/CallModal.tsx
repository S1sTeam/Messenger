import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, Video, Mic, MicOff, VideoOff, PhoneOff, Volume2, VolumeX, Monitor, MonitorOff } from 'lucide-react';
import { useChatStore } from '../store/chatStore';
import styles from './CallModal.module.css';

interface CallModalProps {
  isOpen: boolean;
  callType: 'audio' | 'video';
  recipientName: string;
  recipientId: string;
  onClose: () => void;
}

export const CallModal = ({ isOpen, callType, recipientName, recipientId, onClose }: CallModalProps) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isSpeakerOff, setIsSpeakerOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [callStatus, setCallStatus] = useState<'calling' | 'connected' | 'ended'>('calling');
  const [callDuration, setCallDuration] = useState(0);
  const [signalStrength, setSignalStrength] = useState(5);
  
  const socket = useChatStore((state) => state.socket);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  
  // Звуки
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);
  const connectedSoundRef = useRef<HTMLAudioElement | null>(null);
  const endSoundRef = useRef<HTMLAudioElement | null>(null);

  // Инициализация звуков
  useEffect(() => {
    // Создаем звуки программно (простые тоны)
    const audioContext = new AudioContext();
    
    // Звук звонка
    const createRingtone = () => {
      const audio = new Audio();
      audio.loop = true;
      audio.volume = 0.3;
      // Используем data URL для простого звука
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.frequency.value = 440; // A4
      gainNode.gain.value = 0.1;
      return audio;
    };
    
    ringtoneRef.current = createRingtone();
    connectedSoundRef.current = new Audio();
    endSoundRef.current = new Audio();
    
    return () => {
      ringtoneRef.current?.pause();
      connectedSoundRef.current?.pause();
      endSoundRef.current?.pause();
    };
  }, []);

  // WebRTC конфигурация
  const rtcConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  // Инициализация медиа потоков
  const initializeMedia = async () => {
    try {
      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: callType === 'video' ? {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 60 }
        } : false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;

      if (localVideoRef.current && callType === 'video') {
        localVideoRef.current.srcObject = stream;
      }

      return stream;
    } catch (error) {
      console.error('Ошибка доступа к медиа:', error);
      alert('Не удалось получить доступ к камере/микрофону');
      return null;
    }
  };

  // Создание peer connection
  const createPeerConnection = () => {
    const pc = new RTCPeerConnection(rtcConfiguration);

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('webrtc:ice-candidate', {
          recipientId,
          candidate: event.candidate
        });
      }
    };

    pc.ontrack = (event) => {
      console.log('📹 Получен удаленный поток');
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('🔗 Состояние соединения:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        setCallStatus('connected');
        ringtoneRef.current?.pause();
        // Воспроизводим звук подключения
        playConnectedSound();
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        endCall();
      }
    };

    return pc;
  };

  // Звуки
  const playRingtone = () => {
    ringtoneRef.current?.play().catch(e => console.log('Не удалось воспроизвести звонок:', e));
  };

  const playConnectedSound = () => {
    // Простой звук подключения
    const audioContext = new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    gainNode.gain.value = 0.1;
    
    oscillator.start();
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    oscillator.stop(audioContext.currentTime + 0.3);
  };

  const playEndSound = () => {
    // Простой звук завершения
    const audioContext = new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 400;
    gainNode.gain.value = 0.1;
    
    oscillator.start();
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    oscillator.stop(audioContext.currentTime + 0.5);
  };

  // Инициализация звонка
  useEffect(() => {
    if (isOpen && socket) {
      setCallStatus('calling');
      playRingtone();
      
      initializeMedia().then(async (stream) => {
        if (!stream) return;

        const pc = createPeerConnection();
        peerConnectionRef.current = pc;

        // Добавляем локальные треки
        stream.getTracks().forEach(track => {
          pc.addTrack(track, stream);
        });

        // Создаем offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // Отправляем offer
        socket.emit('webrtc:offer', {
          recipientId,
          offer,
          callType
        });
      });

      // WebRTC сигналинг
      const handleOffer = async ({ senderId, offer }: any) => {
        if (senderId !== recipientId) return;
        
        const stream = await initializeMedia();
        if (!stream) return;

        const pc = createPeerConnection();
        peerConnectionRef.current = pc;

        stream.getTracks().forEach(track => {
          pc.addTrack(track, stream);
        });

        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit('webrtc:answer', {
          recipientId: senderId,
          answer
        });
      };

      const handleAnswer = async ({ answer }: any) => {
        if (peerConnectionRef.current) {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        }
      };

      const handleIceCandidate = async ({ candidate }: any) => {
        if (peerConnectionRef.current && candidate) {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
      };

      const handleCallAnswered = () => {
        console.log('✅ Звонок принят');
        ringtoneRef.current?.pause();
      };

      const handleCallRejected = () => {
        console.log('❌ Звонок отклонен');
        alert('Звонок отклонен');
        endCall();
      };

      const handleCallEnded = () => {
        console.log('📴 Звонок завершен');
        endCall();
      };

      socket.on('webrtc:offer', handleOffer);
      socket.on('webrtc:answer', handleAnswer);
      socket.on('webrtc:ice-candidate', handleIceCandidate);
      socket.on('call:answered', handleCallAnswered);
      socket.on('call:rejected', handleCallRejected);
      socket.on('call:ended', handleCallEnded);

      return () => {
        socket.off('webrtc:offer', handleOffer);
        socket.off('webrtc:answer', handleAnswer);
        socket.off('webrtc:ice-candidate', handleIceCandidate);
        socket.off('call:answered', handleCallAnswered);
        socket.off('call:rejected', handleCallRejected);
        socket.off('call:ended', handleCallEnded);
      };
    }
  }, [isOpen, socket, recipientId, callType]);

  // Таймер звонка
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (callStatus === 'connected') {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
        setSignalStrength(Math.floor(Math.random() * 2) + 4);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [callStatus]);

  // Завершение звонка
  const endCall = () => {
    setCallStatus('ended');
    ringtoneRef.current?.pause();
    playEndSound();

    // Останавливаем все треки
    localStreamRef.current?.getTracks().forEach(track => track.stop());
    screenStreamRef.current?.getTracks().forEach(track => track.stop());

    // Закрываем peer connection
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;

    if (socket && recipientId) {
      socket.emit('call:end', { recipientId });
    }

    setTimeout(() => {
      onClose();
    }, 300);
  };

  // Управление микрофоном
  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  // Управление камерой
  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  // Управление звуком
  const toggleSpeaker = () => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.muted = !remoteVideoRef.current.muted;
      setIsSpeakerOff(remoteVideoRef.current.muted);
    }
  };

  // Демонстрация экрана
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      // Останавливаем демонстрацию
      screenStreamRef.current?.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
      
      // Возвращаем камеру
      if (peerConnectionRef.current && localStreamRef.current) {
        const videoTrack = localStreamRef.current.getVideoTracks()[0];
        const sender = peerConnectionRef.current.getSenders().find(s => s.track?.kind === 'video');
        if (sender && videoTrack) {
          sender.replaceTrack(videoTrack);
        }
      }
      
      setIsScreenSharing(false);
    } else {
      try {
        // Запускаем демонстрацию экрана с высоким качеством
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: 3840 }, // 4K
            height: { ideal: 2160 },
            frameRate: { ideal: 60 }
          },
          audio: true
        });

        screenStreamRef.current = screenStream;
        
        // Заменяем видео трек на трек экрана
        if (peerConnectionRef.current) {
          const screenTrack = screenStream.getVideoTracks()[0];
          const sender = peerConnectionRef.current.getSenders().find(s => s.track?.kind === 'video');
          if (sender && screenTrack) {
            sender.replaceTrack(screenTrack);
          }

          // Обработка остановки демонстрации
          screenTrack.onended = () => {
            toggleScreenShare();
          };
        }

        // Показываем экран в локальном видео
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        setIsScreenSharing(true);
      } catch (error) {
        console.error('Ошибка демонстрации экрана:', error);
        alert('Не удалось начать демонстрацию экрана');
      }
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const firstLetter = recipientName.charAt(0).toUpperCase();
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
    '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52B788'
  ];
  const colorIndex = firstLetter.charCodeAt(0) % colors.length;
  const avatarColor = colors[colorIndex];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={styles.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className={styles.modal}
            initial={{ scale: 0.8, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 50 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            {/* Видео */}
            {callType === 'video' && (
              <div className={styles.videoContainer}>
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className={styles.remoteVideo}
                />
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={styles.localVideo}
                />
              </div>
            )}

            {/* Аудио */}
            {callType === 'audio' && (
              <>
                <div className={styles.backgroundGradient} style={{
                  background: `radial-gradient(circle at 50% 30%, ${avatarColor}40 0%, transparent 70%)`
                }} />

                <div className={styles.callContainer}>
                  {callStatus === 'connected' && (
                    <motion.div 
                      className={styles.signalIndicator}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      {[...Array(5)].map((_, i) => (
                        <div
                          key={i}
                          className={`${styles.signalBar} ${i < signalStrength ? styles.active : ''}`}
                          style={{ height: `${(i + 1) * 4}px` }}
                        />
                      ))}
                    </motion.div>
                  )}

                  {callStatus === 'calling' && (
                    <>
                      {[0, 0.4, 0.8].map((delay, index) => (
                        <motion.div
                          key={index}
                          className={styles.pulseRing}
                          style={{ borderColor: avatarColor }}
                          animate={{
                            scale: [1, 2, 2],
                            opacity: [0.6, 0.3, 0]
                          }}
                          transition={{
                            duration: 2.5,
                            repeat: Infinity,
                            ease: "easeOut",
                            delay
                          }}
                        />
                      ))}
                    </>
                  )}

                  <motion.div
                    className={styles.avatarContainer}
                    animate={callStatus === 'calling' ? {
                      scale: [1, 1.03, 1]
                    } : {}}
                    transition={{
                      duration: 2,
                      repeat: callStatus === 'calling' ? Infinity : 0,
                      ease: "easeInOut"
                    }}
                  >
                    <div
                      className={styles.avatar}
                      style={{ 
                        background: `linear-gradient(135deg, ${avatarColor} 0%, ${avatarColor}dd 100%)`,
                        boxShadow: `0 20px 60px ${avatarColor}60`
                      }}
                    >
                      {firstLetter}
                    </div>
                    
                    {callStatus === 'connected' && !isMuted && (
                      <div className={styles.soundWaves}>
                        {[0, 0.1, 0.2].map((delay, i) => (
                          <motion.div
                            key={i}
                            className={styles.soundWave}
                            animate={{
                              scale: [1, 1.3, 1],
                              opacity: [0.3, 0.6, 0.3]
                            }}
                            transition={{
                              duration: 1.5,
                              repeat: Infinity,
                              delay
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </motion.div>

                  <motion.div 
                    className={styles.callInfo}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <h2>{recipientName}</h2>
                    <motion.div
                      key={callStatus}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={styles.status}
                    >
                      {callStatus === 'calling' && (
                        <motion.div
                          className={styles.callingStatus}
                          animate={{ opacity: [1, 0.5, 1] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                        >
                          <Phone size={18} /> Звонок...
                        </motion.div>
                      )}
                      {callStatus === 'connected' && (
                        <div className={styles.connectedStatus}>
                          <span className={styles.recordingDot} />
                          {formatDuration(callDuration)}
                        </div>
                      )}
                    </motion.div>
                  </motion.div>
                </div>
              </>
            )}

            {/* Кнопки управления */}
            <motion.div 
              className={styles.controls}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <div className={styles.controlsRow}>
                <motion.button
                  className={`${styles.controlBtn} ${isMuted ? styles.active : ''}`}
                  onClick={toggleMute}
                  whileHover={{ scale: 1.1, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
                >
                  {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                </motion.button>

                {callType === 'video' && (
                  <>
                    <motion.button
                      className={`${styles.controlBtn} ${isVideoOff ? styles.active : ''}`}
                      onClick={toggleVideo}
                      whileHover={{ scale: 1.1, y: -2 }}
                      whileTap={{ scale: 0.95 }}
                      title={isVideoOff ? 'Включить камеру' : 'Выключить камеру'}
                    >
                      {isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
                    </motion.button>

                    <motion.button
                      className={`${styles.controlBtn} ${isScreenSharing ? styles.active : ''}`}
                      onClick={toggleScreenShare}
                      whileHover={{ scale: 1.1, y: -2 }}
                      whileTap={{ scale: 0.95 }}
                      title={isScreenSharing ? 'Остановить демонстрацию' : 'Демонстрация экрана'}
                    >
                      {isScreenSharing ? <MonitorOff size={24} /> : <Monitor size={24} />}
                    </motion.button>
                  </>
                )}

                <motion.button
                  className={`${styles.controlBtn} ${isSpeakerOff ? styles.active : ''}`}
                  onClick={toggleSpeaker}
                  whileHover={{ scale: 1.1, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  title={isSpeakerOff ? 'Включить звук' : 'Выключить звук'}
                >
                  {isSpeakerOff ? <VolumeX size={24} /> : <Volume2 size={24} />}
                </motion.button>
              </div>

              <motion.button
                className={`${styles.controlBtn} ${styles.endCall}`}
                onClick={endCall}
                whileHover={{ scale: 1.1, rotate: 135 }}
                whileTap={{ scale: 0.95 }}
                title="Завершить звонок"
              >
                <PhoneOff size={28} />
              </motion.button>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
