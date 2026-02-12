import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { LoginPage } from './pages/LoginPage';
import { MainLayout } from './layouts/MainLayout';
import { IncomingCallModal } from './components/IncomingCallModal';
import { CallModal } from './components/CallModal';
import { useAuthStore } from './store/authStore';
import { useChatStore } from './store/chatStore';
import { toBackendUrl } from './config/network';
import { setThemeFromDarkMode } from './utils/theme';
import './styles/global.css';

export const App = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const logout = useAuthStore((state) => state.logout);
  const socket = useChatStore((state) => state.socket);
  const initSocket = useChatStore((state) => state.initSocket);
  const disconnectSocket = useChatStore((state) => state.disconnectSocket);
  
  const [incomingCall, setIncomingCall] = useState<{
    callerId: string;
    callerName: string;
    chatId?: string;
    callType: 'audio' | 'video';
  } | null>(null);
  
  const [activeCall, setActiveCall] = useState<{
    recipientId: string;
    recipientName: string;
    callType: 'audio' | 'video';
    isInitiator: boolean;
  } | null>(null);

  useEffect(() => {
    // Проверяем, что если есть старый токен с username вместо phone, очищаем
    if (isAuthenticated && user && !user.phone && (user as any).username) {
      console.log('Обнаружен старый формат данных, очистка...');
      logout();
      window.location.reload();
    }
  }, [isAuthenticated, user, logout]);

  useEffect(() => {
    if (token && user?.id) {
      initSocket(token, user.id);
    } else {
      disconnectSocket();
    }
  }, [token, user?.id, initSocket, disconnectSocket]);

  useEffect(() => {
    const syncTheme = async () => {
      if (!token) return;

      try {
        const response = await fetch(toBackendUrl('/api/settings'), {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) return;

        const data = await response.json();
        setThemeFromDarkMode(Boolean(data.settings?.darkMode));
      } catch (error) {
        console.error('Failed to sync theme:', error);
      }
    };

    syncTheme();
  }, [token]);
  
  useEffect(() => {
    if (socket) {
      const handleIncomingCall = ({ callerId, callerName, chatId, callType }: any) => {
        console.log('Incoming call from', callerName);
        setIncomingCall({ callerId, callerName, chatId, callType });
      };

      const handleCallEnded = ({ userId }: { userId: string }) => {
        setIncomingCall((currentCall) => (currentCall?.callerId === userId ? null : currentCall));
        setActiveCall((currentCall) => (currentCall?.recipientId === userId ? null : currentCall));
      };
      
      socket.on('call:incoming', handleIncomingCall);
      socket.on('call:ended', handleCallEnded);
      
      return () => {
        socket.off('call:incoming', handleIncomingCall);
        socket.off('call:ended', handleCallEnded);
      };
    }
  }, [socket]);
  
  const handleAnswerCall = () => {
    if (incomingCall && socket) {
      socket.emit('call:answer', { callerId: incomingCall.callerId });
      setActiveCall({
        recipientId: incomingCall.callerId,
        recipientName: incomingCall.callerName,
        callType: incomingCall.callType,
        isInitiator: false
      });
      setIncomingCall(null);
    }
  };
  
  const handleRejectCall = () => {
    if (incomingCall && socket) {
      socket.emit('call:reject', {
        callerId: incomingCall.callerId,
        chatId: incomingCall.chatId,
        callType: incomingCall.callType,
      });
      setIncomingCall(null);
    }
  };
  
  const handleEndCall = () => {
    setActiveCall(null);
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route 
          path="/login" 
          element={isAuthenticated ? <Navigate to="/chats" /> : <LoginPage />} 
        />
        <Route 
          path="/*" 
          element={isAuthenticated ? <MainLayout /> : <Navigate to="/login" />} 
        />
      </Routes>
      
      {/* Входящий звонок */}
      <IncomingCallModal
        isOpen={!!incomingCall}
        callerName={incomingCall?.callerName || ''}
        callType={incomingCall?.callType || 'audio'}
        onAnswer={handleAnswerCall}
        onReject={handleRejectCall}
      />
      
      {/* Активный звонок (когда ответили) */}
      {activeCall && (
        <CallModal
          isOpen={true}
          callType={activeCall.callType}
          recipientName={activeCall.recipientName}
          recipientId={activeCall.recipientId}
          isInitiator={activeCall.isInitiator}
          onClose={handleEndCall}
        />
      )}
    </BrowserRouter>
  );
};
