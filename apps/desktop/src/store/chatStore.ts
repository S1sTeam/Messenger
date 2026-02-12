import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { SOCKET_ORIGIN } from '../config/network';

interface Message {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  content: string;
  createdAt: Date;
  isRead: boolean;
}

interface Chat {
  id: string;
  name: string;
  avatar: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unread: number;
  participants: string[];
  isPinned?: boolean;
  isArchived?: boolean;
  isMuted?: boolean;
}

interface ChatState {
  socket: Socket | null;
  socketUserId: string | null;
  chats: Chat[];
  messages: Record<string, Message[]>;
  currentChat: string | null;
  isTyping: Record<string, boolean>;
  onlineUsers: Set<string>;
  
  initSocket: (token: string, userId: string) => void;
  disconnectSocket: () => void;
  setCurrentChat: (chatId: string | null) => void;
  sendMessage: (chatId: string, content: string) => void;
  loadChats: () => Promise<void>;
  loadMessages: (chatId: string) => Promise<void>;
  createChat: (userId: string) => Promise<void>;
  setTyping: (chatId: string, isTyping: boolean) => void;
  isUserOnline: (userId: string) => boolean;
}

export const useChatStore = create<ChatState>((set, get) => ({
  socket: null,
  socketUserId: null,
  chats: [],
  messages: {},
  currentChat: null,
  isTyping: {},
  onlineUsers: new Set<string>(),

  initSocket: (token: string, userId: string) => {
    const { socket: existingSocket, socketUserId } = get();

    if (existingSocket && socketUserId === userId && existingSocket.connected) {
      return;
    }

    if (existingSocket) {
      existingSocket.disconnect();
    }

    console.log('Initializing socket for user:', userId);
    const socket = io(SOCKET_ORIGIN, {
      auth: { token },
      query: { userId }
    });

    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    socket.on('message:receive', (message: Message) => {
      console.log('Message received from another user:', message);
      
      set((state) => ({
        messages: {
          ...state.messages,
          [message.chatId]: [...(state.messages[message.chatId] || []), message]
        }
      }));
      
      // Update last message in chat list ONLY if it's from another user
      const currentUserId = userId;
      if (message.senderId !== currentUserId) {
        set((state) => ({
          chats: state.chats.map(chat => 
            chat.id === message.chatId 
              ? { ...chat, lastMessage: message.content, lastMessageTime: 'Сейчас', unread: chat.unread + 1 }
              : chat
          )
        }));
      }
    });

    socket.on('message:sent', (message: Message) => {
      console.log('Message sent confirmation:', message);
      
      // Добавляем своё отправленное сообщение
      set((state) => ({
        messages: {
          ...state.messages,
          [message.chatId]: [...(state.messages[message.chatId] || []), message]
        }
      }));
      
      // Обновляем последнее сообщение в списке чатов БЕЗ увеличения unread
      set((state) => ({
        chats: state.chats.map(chat => 
          chat.id === message.chatId 
            ? { ...chat, lastMessage: message.content, lastMessageTime: 'Сейчас' }
            : chat
        )
      }));
    });

    socket.on('user:typing', (chatId: string) => {
      set((state) => ({
        isTyping: { ...state.isTyping, [chatId]: true }
      }));
      
      setTimeout(() => {
        set((state) => ({
          isTyping: { ...state.isTyping, [chatId]: false }
        }));
      }, 3000);
    });

    // Обработка онлайн статуса
    socket.on('user:online', ({ userId }: { userId: string }) => {
      console.log('User came online:', userId);
      set((state) => {
        const newOnlineUsers = new Set(state.onlineUsers);
        newOnlineUsers.add(userId);
        console.log('Updated online users:', Array.from(newOnlineUsers));
        return { onlineUsers: newOnlineUsers };
      });
    });

    socket.on('user:offline', ({ userId }: { userId: string }) => {
      console.log('User went offline:', userId);
      set((state) => {
        const newOnlineUsers = new Set(state.onlineUsers);
        newOnlineUsers.delete(userId);
        console.log('Updated online users:', Array.from(newOnlineUsers));
        return { onlineUsers: newOnlineUsers };
      });
    });

    socket.on('users:online', (userIds: string[]) => {
      console.log('Online users list received:', userIds.length, 'users', userIds);
      set({ onlineUsers: new Set(userIds) });
    });

    set({ socket, socketUserId: userId });
  },

  disconnectSocket: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null, socketUserId: null, onlineUsers: new Set<string>() });
    }
  },

  setCurrentChat: (chatId: string | null) => {
    set({ currentChat: chatId });
    if (chatId) {
      get().loadMessages(chatId);
    }
  },

  sendMessage: (chatId: string, content: string) => {
    const { socket } = get();
    if (!socket) {
      console.error('Socket not connected');
      return Promise.reject(new Error('Socket not connected'));
    }

    return new Promise<void>((resolve) => {
      const message = {
        chatId,
        content,
        createdAt: new Date()
      };

      console.log('Sending message:', message);
      socket.emit('message:send', message);
      
      // НЕ добавляем оптимистично - дождемся ответа от сервера
      // Сервер вернет сообщение через message:receive
      
      // Update chat list
      set((state) => ({
        chats: state.chats.map(chat => 
          chat.id === chatId 
            ? { ...chat, lastMessage: content, lastMessageTime: 'Сейчас' }
            : chat
        )
      }));

      resolve();
    });
  },

  loadChats: async () => {
    try {
      const authStorage = localStorage.getItem('auth-storage');
      if (!authStorage) return;
      
      const { state } = JSON.parse(authStorage);
      const token = state?.token;
      
      const response = await fetch('http://localhost:3000/api/chats', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        console.error('Failed to load chats, status:', response.status);
        set({ chats: [] });
        return;
      }
      
      const data = await response.json();
      console.log('Chats loaded:', data.chats);
      set({ chats: data.chats || [] });
    } catch (error) {
      console.error('Failed to load chats:', error);
      set({ chats: [] });
    }
  },

  loadMessages: async (chatId: string) => {
    try {
      const authStorage = localStorage.getItem('auth-storage');
      if (!authStorage) return;
      
      const { state } = JSON.parse(authStorage);
      const token = state?.token;
      
      const response = await fetch(`http://localhost:3000/api/chats/${chatId}/messages`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        console.error('Failed to load messages, status:', response.status);
        return;
      }
      
      const data = await response.json();
      console.log('Messages loaded for chat', chatId, ':', data.messages.length, 'messages');
      set((state) => ({
        messages: {
          ...state.messages,
          [chatId]: data.messages || []
        }
      }));
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  },

  createChat: async (userId: string) => {
    try {
      const authStorage = localStorage.getItem('auth-storage');
      if (!authStorage) return;

      const { state } = JSON.parse(authStorage);
      const token = state?.token;
      if (!token) return;

      const response = await fetch('http://localhost:3000/api/chats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ userId })
      });
      if (!response.ok) {
        return;
      }
      const data = await response.json();
      set((state) => ({
        chats: state.chats.some((chat) => chat.id === data.chat.id) ? state.chats : [...state.chats, data.chat]
      }));
    } catch (error) {
      console.error('Failed to create chat:', error);
    }
  },

  setTyping: (chatId: string, isTyping: boolean) => {
    const { socket } = get();
    if (!socket) return;
    
    if (isTyping) {
      socket.emit('user:typing', chatId);
    }
  },

  isUserOnline: (userId: string) => {
    const { onlineUsers } = get();
    return onlineUsers.has(userId);
  }
}));
