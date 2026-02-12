import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { toBackendUrl } from '../config/network';

interface User {
  id: string;
  email?: string;
  phone: string;
  username?: string;
  displayName: string;
  avatar?: string;
}

interface SendCodeResult {
  provider: 'gmail' | 'smtp' | 'mock';
  expiresInSeconds: number;
  debugCode?: string;
}

interface VerifyCodeResult {
  isNewUser: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  sendEmailCode: (email: string) => Promise<SendCodeResult>;
  verifyEmailCode: (email: string, code: string, displayName?: string) => Promise<VerifyCodeResult>;
  logout: () => void;
  setUser: (user: User, token: string) => void;
}

const postJson = async (url: string, body: Record<string, unknown>) => {
  const response = await fetch(toBackendUrl(url), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Request failed');
  }

  return payload;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: async (email: string, password: string) => {
        const data = await postJson('http://localhost:3000/api/auth/login', { email, password });
        set({
          user: data.user,
          token: data.token,
          isAuthenticated: true,
        });
      },

      register: async (email: string, password: string, displayName: string) => {
        const data = await postJson('http://localhost:3000/api/auth/register', { email, password, displayName });
        set({
          user: data.user,
          token: data.token,
          isAuthenticated: true,
        });
      },

      sendEmailCode: async (email: string) => {
        const data = await postJson('http://localhost:3000/api/auth/send-code', { email });
        return {
          provider: data.provider,
          expiresInSeconds: data.expiresInSeconds,
          debugCode: data.debugCode,
        } as SendCodeResult;
      },

      verifyEmailCode: async (email: string, code: string, displayName?: string) => {
        const data = await postJson('http://localhost:3000/api/auth/verify-code', {
          email,
          code,
          displayName,
        });

        set({
          user: data.user,
          token: data.token,
          isAuthenticated: true,
        });

        return {
          isNewUser: Boolean(data.isNewUser),
        };
      },

      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        });
      },

      setUser: (user: User, token: string) => {
        set({
          user,
          token,
          isAuthenticated: true,
        });
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);
