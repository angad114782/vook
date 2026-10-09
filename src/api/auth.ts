import api from './axios';
import { withBotProof } from '../lib/botProof';

export type OtpChannel = 'WHATSAPP' | 'SMS';
export interface LoginOptions {
  password: boolean;
  otp: { enabled: boolean; channels: OtpChannel[]; codeLength: number; resendAfterSeconds: number; expiresInSeconds: number };
  botGuard: { enabled: boolean; turnstileSiteKey: string | null };
}
/** What to show when the server cannot be asked (demo mode, offline): the classic password form only. */
export const PASSWORD_ONLY: LoginOptions = { password: true, otp: { enabled: false, channels: [], codeLength: 6, resendAfterSeconds: 30, expiresInSeconds: 300 }, botGuard: { enabled: false, turnstileSiteKey: null } };

/** True only when the page itself is open on this computer in development; the server checks this again and refuses anywhere else. */
export const isLocalDev = import.meta.env.DEV && typeof window !== 'undefined' && ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
export interface DevAccount { role: string; name: string; email: string }

export const authApi = {
  devAccounts: () => api.get<{ accounts: DevAccount[] }>('/auth/dev-accounts'),
  loginOptions: () => api.get<LoginOptions>('/auth/login-options'),
  requestOtp: async (mobile: string, channel: OtpChannel, website = '') =>
    withBotProof((botProof) => api.post<{ message: string; channel: OtpChannel; expiresInSeconds: number; resendAfterSeconds: number; devOtp?: string }>('/auth/otp/request', { mobile, channel, website, botProof })),
  requestPasswordReset: async (email: string, website = '') =>
    withBotProof((botProof) => api.post<{ message: string; devResetLink?: string }>('/auth/forgot-password', { email, website, botProof })),
  resetPassword: (token: string, newPassword: string) => api.post<{ message: string }>('/auth/reset-password', { token, newPassword }),
};
