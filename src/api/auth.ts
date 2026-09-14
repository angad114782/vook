import api from './axios';

export const authApi = {
  requestPasswordReset: (email: string) => api.post<{ message: string }>('/auth/forgot-password', { email }),
  resetPassword: (token: string, newPassword: string) => api.post<{ message: string }>('/auth/reset-password', { token, newPassword }),
};
