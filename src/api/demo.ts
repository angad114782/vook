import api from './axios';

export interface DemoAccount {
  name: string;
  email: string;
  role: 'SUPER_ADMIN' | 'COMPANY_ADMIN' | 'HR' | 'FINANCE' | 'MANAGER' | 'SUPERVISOR' | 'EMPLOYEE';
  password: string;
}

export const demoApi = {
  accounts: () => api.get<{ accounts: DemoAccount[] }>('/demo/accounts').then((response) => response.data),
  reset: () => api.post<{ resetAt: string }>('/demo/reset').then((response) => response.data),
};
