import api from './axios';

export const platformApi = {
  getBroadcasts: <T>() => api.get<T[]>('/broadcasts'),
  createBroadcast: <T>(data: Record<string, unknown>) => api.post<T>('/broadcasts', data),
  getUsers: async <T>(params: Record<string, unknown>) => {
    const response = await api.get<{ users: T[] }>('/users', { params });
    return { ...response, data: response.data.users };
  },
  revokeUserSessions: (id: string, reason: string) => api.post(`/users/${id}/revoke-sessions`, { reason }),
  updateUser: (id: string, data: Record<string, unknown>) => api.patch(`/users/${id}`, data),
  getEmployees: <T>(params: Record<string, unknown>) => api.get<T>('/employees', { params }),
  updateSettings: (section: string, value: unknown) => api.put('/settings/platform', { [section]: value }),
};
