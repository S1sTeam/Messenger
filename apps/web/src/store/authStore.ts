import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  phone: string;
  username?: string;
  displayName: string;
  avatar?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (phone: string, password: string) => Promise<void>;
  register: (phone: string, password: string, displayName: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User, token: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: async (phone: string, password: string) => {
        try {
          console.log('Attempting login...', { phone });
          const response = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, password }),
          });

          console.log('Login response:', response.status);

          if (!response.ok) {
            const errorData = await response.json();
            console.error('Login error:', errorData);
            
            // Если ошибка токена, очищаем старые данные
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

      register: async (phone: string, password: string, displayName: string) => {
        try {
          console.log('Attempting registration...', { phone, displayName });
          const response = await fetch('http://localhost:3000/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, password, displayName }),
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
