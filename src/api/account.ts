import api from './axios';

export const accountApi = {
  acceptInvitation: (token: string | null, password: string) => api.post('/auth/accept-invitation', { token, password }),
  getSessions: <T>() => api.get<{ sessions: T[] }>('/auth/security/sessions'),
  changePassword: (currentPassword: string, newPassword: string) => api.post('/auth/change-password', { currentPassword, newPassword }),
  revokeAllSessions: () => api.post('/auth/security/revoke-all'),
  revokeSession: (id: string) => api.delete(`/auth/security/sessions/${id}`),
  updateProfile: (data: { name: string; email: string }) => api.patch('/auth/me', data),
  getTwoFactorStatus: <T>() => api.get<T>('/auth/2fa/status'),
  setupTwoFactor: <T>() => api.post<T>('/auth/2fa/setup'),
  verifyTwoFactor: (otp: string) => api.post('/auth/2fa/verify', { otp }),
};
