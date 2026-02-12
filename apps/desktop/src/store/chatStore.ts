import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { SOCKET_ORIGIN } from '../config/network';

const logDebug = (...args: unknown[]) => {
  if (import.meta.env.VITE_ENABLE_DEBUG_LOGS === 'true') {
    console.log(...args);
  }
};

const pendingMessageTimeouts = new Map<string, number>();

const makeClientMessageId = () => `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const readAuthState = () => {
  try {
    const raw = localStorage.getItem('auth-storage');
    if (!raw) return null;
    return JSON.parse(raw)?.state || null;
  } catch {
    return null;
  }
};

interface Message {
  id: string;
  clientMessageId?: string;
  chatId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  content: string;
  createdAt: Date;
  isRead: boolean;
  status?: 'sending' | 'sent' | 'failed';
}

const asSentMessage = (message: Message): Message => ({ ...message, status: 'sent' });

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
  sendMessage: (chatId: string, content: string) => Promise<void>;
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

    if (existingSocket && socketUserId === userId) {
      if (!existingSocket.connected && !existingSocket.active) {
        existingSocket.connect();
      }
      return;
    }

    if (existingSocket) {
      existingSocket.removeAllListeners();
      existingSocket.disconnect();
    }

    const socket = io(SOCKET_ORIGIN, {
      auth: { token },
      query: { userId },
      transports: ['websocket'],
      timeout: 8000,
      reconnectionAttempts: 8,
      reconnectionDelay: 400,
      reconnectionDelayMax: 1500,
    });

    socket.on('connect', () => {
      logDebug('Socket connected:', socket.id);
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
    });

    socket.on('message:receive', (message: Message) => {
      set((state) => {
        const chatMessages = state.messages[message.chatId] || [];
        const alreadyExists = chatMessages.some((item) => item.id === message.id);

        return {
          messages: {
            ...state.messages,
            [message.chatId]: alreadyExists ? chatMessages : [...chatMessages, asSentMessage(message)],
          },
          chats: state.chats.map((chat) =>
            chat.id === message.chatId
              ? {
                  ...chat,
                  lastMessage: message.content,
                  lastMessageTime: 'Сейчас',
                  unread: message.senderId !== userId ? chat.unread + 1 : chat.unread,
                }
              : chat,
          ),
        };
      });
    });

    socket.on('message:sent', (message: Message) => {
      if (message.clientMessageId) {
        const timeoutId = pendingMessageTimeouts.get(message.clientMessageId);
        if (timeoutId) {
          window.clearTimeout(timeoutId);
          pendingMessageTimeouts.delete(message.clientMessageId);
        }
      }

      set((state) => {
        const chatMessages = state.messages[message.chatId] || [];
        const optimisticIndex = message.clientMessageId
          ? chatMessages.findIndex((item) => item.id === message.clientMessageId || item.clientMessageId === message.clientMessageId)
          : -1;

        const mergedMessages =
          optimisticIndex >= 0
            ? chatMessages.map((item, index) => (index === optimisticIndex ? asSentMessage(message) : item))
            : chatMessages.some((item) => item.id === message.id)
              ? chatMessages
              : [...chatMessages, asSentMessage(message)];

        return {
          messages: {
            ...state.messages,
            [message.chatId]: mergedMessages,
          },
          chats: state.chats.map((chat) =>
            chat.id === message.chatId ? { ...chat, lastMessage: message.content, lastMessageTime: 'Сейчас' } : chat,
          ),
        };
      });
    });

    socket.on('user:typing', (chatId: string) => {
      set((state) => ({
        isTyping: { ...state.isTyping, [chatId]: true },
      }));

      window.setTimeout(() => {
        set((state) => ({
          isTyping: { ...state.isTyping, [chatId]: false },
        }));
      }, 3000);
    });

    socket.on('user:online', ({ userId: onlineUserId }: { userId: string }) => {
      set((state) => {
        const newOnlineUsers = new Set(state.onlineUsers);
        newOnlineUsers.add(onlineUserId);
        return { onlineUsers: newOnlineUsers };
      });
    });

    socket.on('user:offline', ({ userId: offlineUserId }: { userId: string }) => {
      set((state) => {
        const newOnlineUsers = new Set(state.onlineUsers);
        newOnlineUsers.delete(offlineUserId);
        return { onlineUsers: newOnlineUsers };
      });
    });

    socket.on('users:online', (userIds: string[]) => {
      set({ onlineUsers: new Set(userIds) });
    });

    set({ socket, socketUserId: userId });
  },

  disconnectSocket: () => {
    const { socket } = get();
    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
    }

    for (const timeoutId of pendingMessageTimeouts.values()) {
      window.clearTimeout(timeoutId);
    }
    pendingMessageTimeouts.clear();

    set({ socket: null, socketUserId: null, onlineUsers: new Set<string>() });
  },

  setCurrentChat: (chatId: string | null) => {
    set({ currentChat: chatId });
    if (chatId) {
      void get().loadMessages(chatId);
    }
  },

  sendMessage: async (chatId: string, content: string) => {
    const { socket } = get();
    if (!socket) {
      throw new Error('Socket not connected');
    }

    const normalizedContent = content.trim();
    if (!normalizedContent) {
      return;
    }

    const authState = readAuthState();
    const currentUser = authState?.user;
    const clientMessageId = makeClientMessageId();

    const optimisticMessage: Message = {
      id: clientMessageId,
      clientMessageId,
      chatId,
      senderId: currentUser?.id || '',
      senderName: currentUser?.displayName || currentUser?.phone || 'Вы',
      senderAvatar: currentUser?.avatar || '👤',
      content: normalizedContent,
      createdAt: new Date(),
      isRead: true,
      status: 'sending',
    };

    set((state) => ({
      messages: {
        ...state.messages,
        [chatId]: [...(state.messages[chatId] || []), optimisticMessage],
      },
      chats: state.chats.map((chat) =>
        chat.id === chatId ? { ...chat, lastMessage: normalizedContent, lastMessageTime: 'Сейчас' } : chat,
      ),
    }));

    const failTimeout = window.setTimeout(() => {
      set((state) => ({
        messages: {
          ...state.messages,
          [chatId]: (state.messages[chatId] || []).map((item) =>
            item.id === clientMessageId ? { ...item, status: 'failed' } : item,
          ),
        },
      }));
      pendingMessageTimeouts.delete(clientMessageId);
    }, 12000);

    pendingMessageTimeouts.set(clientMessageId, failTimeout);

    socket.emit('message:send', {
      chatId,
      content: normalizedContent,
      createdAt: new Date(),
      clientMessageId,
    });
  },

  loadChats: async () => {
    try {
      const authState = readAuthState();
      const token = authState?.token;
      if (!token) return;

      const response = await fetch('/api/chats', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        set({ chats: [] });
        return;
      }

      const data = await response.json();
      set({ chats: data.chats || [] });
    } catch (error) {
      console.error('Failed to load chats:', error);
      set({ chats: [] });
    }
  },

  loadMessages: async (chatId: string) => {
    try {
      const authState = readAuthState();
      const token = authState?.token;
      if (!token) return;

      const response = await fetch(`/api/chats/${chatId}/messages?limit=120`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        return;
      }

      const data = await response.json();
      set((state) => ({
        messages: {
          ...state.messages,
          [chatId]: data.messages || [],
        },
      }));
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  },

  createChat: async (userId: string) => {
    try {
      const authState = readAuthState();
      const token = authState?.token;
      if (!token) return;

      const response = await fetch('/api/chats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        return;
      }

      const data = await response.json();
      set((state) => ({
        chats: state.chats.some((chat) => chat.id === data.chat.id) ? state.chats : [...state.chats, data.chat],
      }));
    } catch (error) {
      console.error('Failed to create chat:', error);
    }
  },

  setTyping: (chatId: string, isTyping: boolean) => {
    const { socket } = get();
    if (!socket || !isTyping) return;
    socket.emit('user:typing', chatId);
  },

  isUserOnline: (userId: string) => {
    const { onlineUsers } = get();
    return onlineUsers.has(userId);
  },
}));
