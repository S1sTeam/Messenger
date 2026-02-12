import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  phone: string;
  username?: string;
  displayName: string;
  avatar?: string;
}

interface SendCodeResult {
  provider: 'twilio' | 'mock';
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
  login: (phone: string, password: string) => Promise<void>;
  register: (phone: string, password: string, displayName: string) => Promise<void>;
  sendPhoneCode: (phone: string) => Promise<SendCodeResult>;
  verifyPhoneCode: (phone: string, code: string, displayName?: string) => Promise<VerifyCodeResult>;
  logout: () => void;
  setUser: (user: User, token: string) => void;
}

const postJson = async (url: string, body: Record<string, unknown>) => {
  const response = await fetch(url, {
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

      login: async (phone: string, password: string) => {
        const data = await postJson('http://localhost:3000/api/auth/login', { phone, password });
        set({
          user: data.user,
          token: data.token,
          isAuthenticated: true,
        });
      },

      register: async (phone: string, password: string, displayName: string) => {
        const data = await postJson('http://localhost:3000/api/auth/register', { phone, password, displayName });
        set({
          user: data.user,
          token: data.token,
          isAuthenticated: true,
        });
      },

      sendPhoneCode: async (phone: string) => {
        const data = await postJson('http://localhost:3000/api/auth/send-code', { phone });
        return {
          provider: data.provider,
          expiresInSeconds: data.expiresInSeconds,
          debugCode: data.debugCode,
        } as SendCodeResult;
      },

      verifyPhoneCode: async (phone: string, code: string, displayName?: string) => {
        const data = await postJson('http://localhost:3000/api/auth/verify-code', {
          phone,
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
