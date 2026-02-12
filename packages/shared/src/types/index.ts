export interface User {
  id: string;
  username: string;
  displayName: string;
  avatar?: string;
  bio?: string;
  createdAt: Date;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  type: 'text' | 'image' | 'file' | 'voice';
  createdAt: Date;
  updatedAt?: Date;
  isRead: boolean;
}

export interface Chat {
  id: string;
  type: 'private' | 'group';
  name?: string;
  avatar?: string;
  participants: string[];
  lastMessage?: Message;
  createdAt: Date;
}

export interface Post {
  id: string;
  authorId: string;
  content: string;
  images?: string[];
  likes: number;
  reposts: number;
  comments: number;
  createdAt: Date;
}

export interface SocketEvents {
  'message:send': (message: Message) => void;
  'message:receive': (message: Message) => void;
  'message:read': (messageId: string) => void;
  'user:typing': (chatId: string, userId: string) => void;
  'user:online': (userId: string) => void;
  'user:offline': (userId: string) => void;
}
