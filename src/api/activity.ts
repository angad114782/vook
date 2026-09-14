import api from './axios';

export interface ActivityLog {
  id: string;
  action: string;
  module?: string;
  status: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  user?: { id: string; name: string; email: string; role: string };
  company?: { id: string; name: string; companyCode: string };
}

export interface ActivityResponse {
  logs: ActivityLog[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
  stats: { total: number; today: number; success: number; failed: number };
}

export const activityApi = {
  getAll: (params?: Record<string, string>) =>
    api.get<ActivityResponse>('/activity', { params }),
  getCompanies: () =>
    api.get<{ id: string; name: string; companyCode: string }[]>('/activity/companies'),
};
