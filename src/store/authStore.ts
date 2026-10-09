import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api, { setCsrfToken } from '../api/axios';
import { withBotProof } from '../lib/botProof';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string | null;
  company?: { id: string; name: string; companyCode: string } | null;
  twoFactorEnabled?: boolean;
  twoFactorEnrollmentRequired?: boolean;
  twoFactorEnrollmentDeadline?: string;
}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  /** `identifier` is an email address or a mobile number. */
  login: (identifier: string, password: string, otp?: string, website?: string) => Promise<void>;
  loginWithOtp: (mobile: string, code: string, totp?: string) => Promise<void>;
  /** Local development only: sign in as a sample person with one click. The server refuses this anywhere else. */
  devLogin: (role: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (patch: Partial<AuthUser>) => void;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isLoading: false,
      login: async (identifier, password, otp, website) => {
        set({ isLoading: true });
        try {
          // `email` is kept for older servers and demo mode; `identifier` accepts email or mobile.
          const { data } = await withBotProof((botProof) => api.post('/auth/login', { identifier, email: identifier, password, website, botProof, ...(otp ? { otp } : {}) }));
          setCsrfToken(data.csrfToken ?? null);
          set({ user: data.user, isLoading: false });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },
      devLogin: async (role) => {
        set({ isLoading: true });
        try {
          const { data } = await api.post('/auth/dev-login', { role });
          setCsrfToken(data.csrfToken ?? null);
          set({ user: data.user, isLoading: false });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },
      loginWithOtp: async (mobile, code, totp) => {
        set({ isLoading: true });
        try {
          const { data } = await api.post('/auth/otp/verify', { mobile, code, ...(totp ? { totp } : {}) });
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
