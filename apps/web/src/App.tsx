import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { LoginPage } from './pages/LoginPage';
import { MainLayout } from './layouts/MainLayout';
import { IncomingCallModal } from './components/IncomingCallModal';
import { CallModal } from './components/CallModal';
import { useAuthStore } from './store/authStore';
import { useChatStore } from './store/chatStore';
import { toBackendUrl } from './config/network';
import './styles/global.css';

export const App = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const logout = useAuthStore((state) => state.logout);
  const socket = useChatStore((state) => state.socket);
  
  const [incomingCall, setIncomingCall] = useState<{
    callerId: string;
    callerName: string;
    callType: 'audio' | 'video';
  } | null>(null);
  
  const [activeCall, setActiveCall] = useState<{
    recipientId: string;
    recipientName: string;
    callType: 'audio' | 'video';
  } | null>(null);

  useEffect(() => {
    // Проверяем, что если есть старый токен с username вместо phone, очищаем
    if (isAuthenticated && user && !user.phone && (user as any).username) {
      console.log('⚠️ Обнаружен старый формат данных, очистка...');
      logout();
      window.location.reload();
    }
  }, [isAuthenticated, user, logout]);

  useEffect(() => {
    const validateSession = async () => {
      if (!token) return;

      try {
        const response = await fetch(toBackendUrl('/api/settings'), {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.status === 401) {
          logout();
        }
      } catch (error) {
        console.error('Session validation failed:', error);
      }
    };

    validateSession();
  }, [token, logout]);
  
  useEffect(() => {
    if (socket) {
      const handleIncomingCall = ({ callerId, callerName, callType }: any) => {
        console.log('📞 Входящий звонок от', callerName);
        setIncomingCall({ callerId, callerName, callType });
      };
      
      socket.on('call:incoming', handleIncomingCall);
      
      return () => {
        socket.off('call:incoming', handleIncomingCall);
      };
    }
  }, [socket]);
  
  const handleAnswerCall = () => {
    if (incomingCall && socket) {
      socket.emit('call:answer', { callerId: incomingCall.callerId });
      setActiveCall({
        recipientId: incomingCall.callerId,
        recipientName: incomingCall.callerName,
        callType: incomingCall.callType
      });
      setIncomingCall(null);
    }
  };
  
  const handleRejectCall = () => {
    if (incomingCall && socket) {
      socket.emit('call:reject', { callerId: incomingCall.callerId });
      setIncomingCall(null);
    }
  };
  
  const handleEndCall = () => {
    setActiveCall(null);
  };

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
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
          onClose={handleEndCall}
        />
      )}
    </BrowserRouter>
  );
};
