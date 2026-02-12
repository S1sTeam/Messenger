import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  MicOff,
  Monitor,
  MonitorOff,
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useChatStore } from '../store/chatStore';
import { ICE_SERVERS } from '../config/network';
import styles from './CallModal.module.css';

interface CallModalProps {
  isOpen: boolean;
  callType: 'audio' | 'video';
  recipientName: string;
  recipientId: string;
  chatId?: string;
  onClose: () => void;
  isInitiator?: boolean;
}

export const CallModal = ({
  isOpen,
  callType,
  recipientName,
  recipientId,
  chatId,
  onClose,
  isInitiator = true,
}: CallModalProps) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isSpeakerOff, setIsSpeakerOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [callStatus, setCallStatus] = useState<'calling' | 'connecting' | 'connected' | 'ended'>('calling');
  const [callDuration, setCallDuration] = useState(0);
  const [signalStrength, setSignalStrength] = useState(5);

  const socket = useChatStore((state) => state.socket);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const microphoneTrackRef = useRef<MediaStreamTrack | null>(null);
  const screenAudioTrackRef = useRef<MediaStreamTrack | null>(null);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const endingRef = useRef(false);
  const callerStartedRef = useRef(false);

  const cameraVideoConstraints: MediaTrackConstraints = {
    width: { ideal: 1920, max: 1920 },
    height: { ideal: 1080, max: 1080 },
    frameRate: { ideal: 60, max: 60 },
  };

  const fallbackCameraVideoConstraints: MediaTrackConstraints = {
    width: { ideal: 1280, max: 1280 },
    height: { ideal: 720, max: 720 },
    frameRate: { ideal: 30, max: 30 },
  };

  const screenVideoConstraints: MediaTrackConstraints = {
    width: { ideal: 1920, max: 1920 },
    height: { ideal: 1080, max: 1080 },
    frameRate: { ideal: 60, max: 60 },
  };

  const rtcConfiguration: RTCConfiguration = {
    iceServers: ICE_SERVERS,
  };

  const cleanupResources = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    screenStreamRef.current?.getTracks().forEach((track) => track.stop());

    localStreamRef.current = null;
    screenStreamRef.current = null;
    microphoneTrackRef.current = null;
    screenAudioTrackRef.current = null;
    pendingIceCandidatesRef.current = [];
    callerStartedRef.current = false;

    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }

    setIsScreenSharing(false);
  }, []);

  const endCall = useCallback(
    (notifyPeer = true) => {
      if (endingRef.current) return;
      endingRef.current = true;

      setCallStatus('ended');

      if (notifyPeer && socket && recipientId) {
        socket.emit('call:end', { recipientId });
      }

      cleanupResources();

      setTimeout(() => {
        onClose();
      }, 200);
    },
    [cleanupResources, onClose, recipientId, socket],
  );

  const initializeMedia = useCallback(async () => {
    if (localStreamRef.current) {
      return localStreamRef.current;
    }

    try {
      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      };

      const stream =
        callType === 'video'
          ? await navigator.mediaDevices
              .getUserMedia({
                audio: audioConstraints,
                video: cameraVideoConstraints,
              })
              .catch(async (error) => {
                console.warn('Primary camera profile failed, fallback to 720p30:', error);
                return navigator.mediaDevices.getUserMedia({
                  audio: audioConstraints,
                  video: fallbackCameraVideoConstraints,
                });
              })
          : await navigator.mediaDevices.getUserMedia({
              audio: audioConstraints,
              video: false,
            });

      localStreamRef.current = stream;
      microphoneTrackRef.current = stream.getAudioTracks()[0] || null;

      const localVideoTrack = stream.getVideoTracks()[0];
      if (localVideoTrack && 'contentHint' in localVideoTrack) {
        localVideoTrack.contentHint = 'motion';
      }

      if (callType === 'video' && localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      return stream;
    } catch (error) {
      console.error('Media access error:', error);
      alert('Не удалось получить доступ к камере/микрофону');
      return null;
    }
  }, [callType]);

  const attachLocalTracks = (pc: RTCPeerConnection, stream: MediaStream) => {
    const senderKinds = new Set(pc.getSenders().map((sender) => sender.track?.kind));

    stream.getTracks().forEach((track) => {
      if (!senderKinds.has(track.kind)) {
        pc.addTrack(track, stream);
      }
    });
  };

  const flushPendingIceCandidates = useCallback(async (pc: RTCPeerConnection) => {
    if (!pc.remoteDescription || pendingIceCandidatesRef.current.length === 0) return;

    const queuedCandidates = [...pendingIceCandidatesRef.current];
    pendingIceCandidatesRef.current = [];

    for (const candidate of queuedCandidates) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.warn('ICE candidate add failed:', error);
      }
    }
  }, []);

  const applyVideoSenderProfile = useCallback(async (mode: 'camera' | 'screen') => {
    const pc = peerConnectionRef.current;
    if (!pc) return;

    const sender = pc.getSenders().find((item) => item.track?.kind === 'video');
    if (!sender) return;

    try {
      const parameters = sender.getParameters();
      const baseEncoding = parameters.encodings && parameters.encodings.length > 0 ? parameters.encodings : [{}];

      parameters.degradationPreference = mode === 'screen' ? 'maintain-resolution' : 'balanced';
      parameters.encodings = baseEncoding.map((encoding) => ({
        ...encoding,
        maxFramerate: 60,
        maxBitrate: mode === 'screen' ? 8_000_000 : 4_000_000,
      }));

      await sender.setParameters(parameters);
    } catch (error) {
      console.warn('Failed to apply video sender profile:', error);
    }
  }, []);

  const replaceVideoTrack = useCallback(
    async (track: MediaStreamTrack, mode: 'camera' | 'screen') => {
      const pc = peerConnectionRef.current;
      if (!pc) return;

      const sender = pc.getSenders().find((item) => item.track?.kind === 'video');
      if (!sender) return;

      if ('contentHint' in track) {
        track.contentHint = mode === 'screen' ? 'detail' : 'motion';
      }

      await sender.replaceTrack(track);
      await applyVideoSenderProfile(mode);
    },
    [applyVideoSenderProfile],
  );

  const replaceAudioTrack = useCallback(async (track: MediaStreamTrack | null) => {
    const pc = peerConnectionRef.current;
    if (!pc) return;

    const sender = pc.getSenders().find((item) => item.track?.kind === 'audio');
    if (!sender) return;

    await sender.replaceTrack(track);
  }, []);

  const createPeerConnection = useCallback(
    (stream: MediaStream | null) => {
      if (peerConnectionRef.current) {
        return peerConnectionRef.current;
      }

      const pc = new RTCPeerConnection(rtcConfiguration);

      if (stream) {
        attachLocalTracks(pc, stream);
      }

      pc.onicecandidate = (event) => {
        if (!event.candidate || !socket || !recipientId) return;

        socket.emit('webrtc:ice-candidate', {
          recipientId,
          candidate: event.candidate,
        });
      };

      pc.ontrack = (event) => {
        const [remoteStream] = event.streams;
        if (!remoteStream) return;

        if (callType === 'video' && remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }

        if (callType === 'audio' && remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = remoteStream;
        }
      };

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;

        if (state === 'connected') {
          setCallStatus('connected');
          return;
        }

        if (state === 'connecting' || state === 'disconnected') {
          setCallStatus((prev) => (prev === 'connected' ? prev : 'connecting'));
          return;
        }

        if ((state === 'failed' || state === 'closed') && !endingRef.current) {
          endCall(false);
        }
      };

      peerConnectionRef.current = pc;

      if (stream && stream.getVideoTracks().length > 0) {
        void applyVideoSenderProfile('camera');
      }

      return pc;
    },
    [applyVideoSenderProfile, callType, endCall, recipientId, socket],
  );

  const startAsCaller = useCallback(async () => {
    if (callerStartedRef.current || !socket || !recipientId) {
      return;
    }

    callerStartedRef.current = true;
    setCallStatus('connecting');

    try {
      const stream = await initializeMedia();
      if (!stream) {
        endCall(false);
        return;
      }

      const pc = createPeerConnection(stream);
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: callType === 'video',
      });

      await pc.setLocalDescription(offer);

      socket.emit('webrtc:offer', {
        recipientId,
        offer,
        callType,
      });
    } catch (error) {
      console.error('Failed to start caller peer connection:', error);
      endCall(false);
    }
  }, [callType, createPeerConnection, endCall, initializeMedia, recipientId, socket]);

  const prepareAsReceiver = useCallback(async () => {
    setCallStatus('connecting');

    const stream = await initializeMedia();
    if (!stream) {
      endCall(false);
      return;
    }

    createPeerConnection(stream);
  }, [createPeerConnection, endCall, initializeMedia]);

  useEffect(() => {
    if (!isOpen || !socket || !recipientId) {
      return;
    }

    endingRef.current = false;
    callerStartedRef.current = false;
    pendingIceCandidatesRef.current = [];

    setCallDuration(0);
    setSignalStrength(5);
    setIsMuted(false);
    setIsVideoOff(false);
    setIsSpeakerOff(false);
    setIsScreenSharing(false);
    setCallStatus(isInitiator ? 'calling' : 'connecting');

    const handleOffer = async ({ senderId, offer }: { senderId: string; offer: RTCSessionDescriptionInit }) => {
      if (senderId !== recipientId || endingRef.current) return;

      try {
        const stream = await initializeMedia();
        if (!stream) return;

        const pc = createPeerConnection(stream);

        if (pc.signalingState === 'have-local-offer') {
          await pc.setLocalDescription({ type: 'rollback' });
        }

        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        await flushPendingIceCandidates(pc);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit('webrtc:answer', {
          recipientId: senderId,
          answer,
        });
      } catch (error) {
        console.error('Failed to handle WebRTC offer:', error);
        endCall(false);
      }
    };

    const handleAnswer = async ({ senderId, answer }: { senderId: string; answer: RTCSessionDescriptionInit }) => {
      if (senderId !== recipientId || endingRef.current) return;

      const pc = peerConnectionRef.current;
      if (!pc || pc.signalingState !== 'have-local-offer') return;

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        await flushPendingIceCandidates(pc);
      } catch (error) {
        console.error('Failed to handle WebRTC answer:', error);
        endCall(false);
      }
    };

    const handleIceCandidate = async ({ senderId, candidate }: { senderId: string; candidate: RTCIceCandidateInit }) => {
      if (senderId !== recipientId || endingRef.current || !candidate) return;

      const pc = peerConnectionRef.current;
      if (!pc || !pc.remoteDescription) {
        pendingIceCandidatesRef.current.push(candidate);
        return;
      }

      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.warn('ICE candidate add failed:', error);
      }
    };

    const handleCallAnswered = ({ userId }: { userId: string }) => {
      if (!isInitiator || userId !== recipientId) return;
      startAsCaller();
    };

    const handleCallRejected = ({ userId }: { userId: string }) => {
      if (userId !== recipientId) return;
      alert('Звонок отклонен');
      endCall(false);
    };

    const handleCallEnded = ({ userId }: { userId: string }) => {
      if (userId !== recipientId) return;
      endCall(false);
    };

    const handleCallOffline = ({ reason }: { reason?: string }) => {
      if (!isInitiator) return;
      alert(reason || 'Пользователь сейчас не в сети');
      endCall(false);
    };

    socket.on('webrtc:offer', handleOffer);
    socket.on('webrtc:answer', handleAnswer);
    socket.on('webrtc:ice-candidate', handleIceCandidate);
    socket.on('call:answered', handleCallAnswered);
    socket.on('call:rejected', handleCallRejected);
    socket.on('call:ended', handleCallEnded);
    socket.on('call:offline', handleCallOffline);

    if (!isInitiator) {
      prepareAsReceiver();
    }

    return () => {
      socket.off('webrtc:offer', handleOffer);
      socket.off('webrtc:answer', handleAnswer);
      socket.off('webrtc:ice-candidate', handleIceCandidate);
      socket.off('call:answered', handleCallAnswered);
      socket.off('call:rejected', handleCallRejected);
      socket.off('call:ended', handleCallEnded);
      socket.off('call:offline', handleCallOffline);

      cleanupResources();
    };
  }, [
    cleanupResources,
    createPeerConnection,
    endCall,
    flushPendingIceCandidates,
    initializeMedia,
    isInitiator,
    isOpen,
    prepareAsReceiver,
    recipientId,
    socket,
    startAsCaller,
  ]);

  useEffect(() => {
    if (!isOpen || !isInitiator || callStatus !== 'calling') {
      return;
    }

    void initializeMedia();
  }, [callStatus, initializeMedia, isInitiator, isOpen]);

  // Если исходящий звонок не приняли за 30 секунд, считаем его пропущенным.
  useEffect(() => {
    if (!isOpen || !isInitiator || callStatus !== 'calling' || !socket || !recipientId) {
      return;
    }

    const timerId = window.setTimeout(() => {
      if (endingRef.current) return;

      socket.emit('call:missed', { recipientId, chatId, callType });
      alert('Пользователь не ответил');
      endCall(true);
    }, 30000);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [callStatus, callType, chatId, endCall, isInitiator, isOpen, recipientId, socket]);

  useEffect(() => {
    let interval: number | undefined;

    if (callStatus === 'connected') {
      interval = window.setInterval(() => {
        setCallDuration((prev) => prev + 1);
        setSignalStrength(Math.floor(Math.random() * 2) + 4);
      }, 1000);
    }

    return () => {
      if (interval) {
        window.clearInterval(interval);
      }
    };
  }, [callStatus]);

  const toggleMute = () => {
    const pc = peerConnectionRef.current;
    const senderAudioTrack = pc?.getSenders().find((item) => item.track?.kind === 'audio')?.track || null;
    const audioTrack = senderAudioTrack || localStreamRef.current?.getAudioTracks()[0];
    if (!audioTrack) return;

    audioTrack.enabled = !audioTrack.enabled;
    setIsMuted(!audioTrack.enabled);
  };

  const toggleVideo = () => {
    const videoTrack = localStreamRef.current?.getVideoTracks()[0];
    if (!videoTrack) return;

    videoTrack.enabled = !videoTrack.enabled;
    setIsVideoOff(!videoTrack.enabled);
  };

  const toggleSpeaker = () => {
    if (callType === 'video' && remoteVideoRef.current) {
      remoteVideoRef.current.muted = !remoteVideoRef.current.muted;
      setIsSpeakerOff(remoteVideoRef.current.muted);
      return;
    }

    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = !remoteAudioRef.current.muted;
      setIsSpeakerOff(remoteAudioRef.current.muted);
    }
  };

  const toggleScreenShare = async () => {
    if (callType !== 'video') return;

    const localStream = localStreamRef.current;

    if (!localStream) return;

    if (isScreenSharing) {
      screenStreamRef.current?.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
      screenAudioTrackRef.current = null;

      const cameraTrack = localStream.getVideoTracks()[0];
      if (cameraTrack) {
        await replaceVideoTrack(cameraTrack, 'camera');
      }

      const micTrack = microphoneTrackRef.current || localStream.getAudioTracks()[0] || null;
      if (micTrack) {
        micTrack.enabled = !isMuted;
      }
      await replaceAudioTrack(micTrack);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream;
      }

      setIsScreenSharing(false);
      return;
    }

    try {
      let screenStream: MediaStream;
      try {
        screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: screenVideoConstraints,
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });
      } catch {
        try {
          screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: screenVideoConstraints,
            audio: false,
          });
        } catch {
          screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: false,
          });
        }
      }

      const screenTrack = screenStream.getVideoTracks()[0];
      if (!screenTrack) return;
      const screenAudioTrack = screenStream.getAudioTracks()[0] || null;

      await replaceVideoTrack(screenTrack, 'screen');
      if (screenAudioTrack) {
        screenAudioTrack.enabled = !isMuted;
        screenAudioTrackRef.current = screenAudioTrack;
        await replaceAudioTrack(screenAudioTrack);
      } else {
        screenAudioTrackRef.current = null;
        console.warn('Screen share started without audio track');
      }

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = screenStream;
      }

      screenTrack.onended = async () => {
        setIsScreenSharing(false);
        const cameraTrack = localStreamRef.current?.getVideoTracks()[0];

        if (cameraTrack) {
          await replaceVideoTrack(cameraTrack, 'camera');
        }

        const micTrack = microphoneTrackRef.current || localStreamRef.current?.getAudioTracks()[0] || null;
        if (micTrack) {
          micTrack.enabled = !isMuted;
        }
        await replaceAudioTrack(micTrack);
        screenAudioTrackRef.current = null;

        if (localVideoRef.current && localStreamRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }
      };

      screenStreamRef.current = screenStream;
      setIsScreenSharing(true);
    } catch (error) {
      console.error('Screen share error:', error);
      alert('Не удалось начать демонстрацию экрана');
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const firstLetter = recipientName.charAt(0).toUpperCase();
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52B788'];
  const colorIndex = firstLetter.charCodeAt(0) % colors.length;
  const avatarColor = colors[colorIndex];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div className={styles.overlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div
            className={styles.modal}
            initial={{ scale: 0.8, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 50 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            <audio ref={remoteAudioRef} autoPlay />

            {callType === 'video' && (
              <div className={styles.videoContainer}>
                <video ref={remoteVideoRef} autoPlay playsInline className={styles.remoteVideo} />
                <video ref={localVideoRef} autoPlay playsInline muted className={styles.localVideo} />
              </div>
            )}

            {callType === 'audio' && (
              <>
                <div
                  className={styles.backgroundGradient}
                  style={{ background: `radial-gradient(circle at 50% 30%, ${avatarColor}40 0%, transparent 70%)` }}
                />

                <div className={styles.callContainer}>
                  {callStatus === 'connected' && (
                    <motion.div className={styles.signalIndicator} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
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
                            opacity: [0.6, 0.3, 0],
                          }}
                          transition={{
                            duration: 2.5,
                            repeat: Infinity,
                            ease: 'easeOut',
                            delay,
                          }}
                        />
                      ))}
                    </>
                  )}

                  <motion.div
                    className={styles.avatarContainer}
                    animate={callStatus === 'calling' ? { scale: [1, 1.03, 1] } : {}}
                    transition={{
                      duration: 2,
                      repeat: callStatus === 'calling' ? Infinity : 0,
                      ease: 'easeInOut',
                    }}
                  >
                    <div
                      className={styles.avatar}
                      style={{
                        background: `linear-gradient(135deg, ${avatarColor} 0%, ${avatarColor}dd 100%)`,
                        boxShadow: `0 20px 60px ${avatarColor}60`,
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
                              opacity: [0.3, 0.6, 0.3],
                            }}
                            transition={{
                              duration: 1.5,
                              repeat: Infinity,
                              delay,
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </motion.div>

                  <motion.div className={styles.callInfo} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                    <h2>{recipientName}</h2>
                    <motion.div key={callStatus} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={styles.status}>
                      {callStatus === 'calling' && (
                        <motion.div className={styles.callingStatus} animate={{ opacity: [1, 0.5, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
                          <Phone size={18} /> Ожидание ответа...
                        </motion.div>
                      )}

                      {callStatus === 'connecting' && (
                        <motion.div className={styles.callingStatus} animate={{ opacity: [1, 0.5, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
                          <Phone size={18} /> Подключение...
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

            <motion.div className={styles.controls} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
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
                onClick={() => endCall(true)}
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
