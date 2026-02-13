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

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User, token: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: async (email: string, password: string) => {
        try {
          console.log('Attempting login...', { email });
          const response = await fetch(toBackendUrl('/api/auth/login'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          });

          console.log('Login response:', response.status);

          if (!response.ok) {
            const errorData = await response.json();
            console.error('Login error:', errorData);

            if (response.status === 401) {
              set({ user: null, token: null, isAuthenticated: false });
            }

            throw new Error(errorData.error || 'Ошибка входа');
          }

          const data = await response.json();
          console.log('Login success:', data);
          set({
            user: data.user,
            token: data.token,
            isAuthenticated: true,
          });
        } catch (error) {
          console.error('Login exception:', error);
          throw error;
        }
      },

      register: async (email: string, password: string, displayName: string) => {
        try {
          console.log('Attempting registration...', { email, displayName });
          const response = await fetch(toBackendUrl('/api/auth/register'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, displayName }),
          });

          console.log('Register response:', response.status);

          if (!response.ok) {
            const errorData = await response.json();
            console.error('Register error:', errorData);
            throw new Error(errorData.error || 'Ошибка регистрации');
          }

          const data = await response.json();
          console.log('Register success:', data);
          set({
            user: data.user,
            token: data.token,
            isAuthenticated: true,
          });
        } catch (error) {
          console.error('Register exception:', error);
          throw error;
        }
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
