import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api, { setCsrfToken } from '../api/axios';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  company?: { id: string; name: string; companyCode: string } | null;
  twoFactorEnabled?: boolean;
  twoFactorEnrollmentRequired?: boolean;
  twoFactorEnrollmentDeadline?: string;
}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string, otp?: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (patch: Partial<AuthUser>) => void;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isLoading: false,
      login: async (email, password, otp) => {
        set({ isLoading: true });
        try {
          const { data } = await api.post('/auth/login', { email, password, ...(otp ? { otp } : {}) });
          setCsrfToken(data.csrfToken ?? null);
          set({ user: data.user, isLoading: false });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },
      logout: async () => {
        try { await api.post('/auth/logout'); } catch { /* local state still clears */ }
        setCsrfToken(null);
        set({ user: null });
      },
      setUser: (patch) => set((state) => ({ user: state.user ? { ...state.user, ...patch } : null })),
      hydrate: async () => {
        try {
          const { data } = await api.get('/auth/session');
          setCsrfToken(data.csrfToken ?? null);
          set({ user: data.user });
        } catch {
          setCsrfToken(null);
          set({ user: null });
        }
      },
    }),
    { name: 'vook-auth-display', partialize: (state) => ({ user: state.user }) },
  ),
);
