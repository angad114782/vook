import api from './axios';

export interface Company {
  id: string;
  companyCode: string;
  name: string;
  legalName?: string;
  displayName?: string;
  industry?: string;
  email?: string;
  phone?: string;
  address?: string;
  plan: string;
  status: 'ACTIVE' | 'TRIAL' | 'GRACE_PERIOD' | 'EXPIRED' | 'SUSPENDED';
  maxUsers: number;
  userCount: number;
  planExpiry?: string;
  createdAt: string;
}

export interface CompaniesResponse {
  companies: Company[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
  stats: { total: number; active: number; trial: number; expiringSoon: number };
}

export interface UpdateCompanyData {
  name: string;
  industry?: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface CreateCompanyData {
  name: string; industry?: string; adminName: string; adminEmail: string; adminMobile?: string;
  planVersionId: string; billingCycle: 'Monthly' | 'Annual'; trialDays: number; password?: string;
}
export type CreatedCompany = Company & { temporaryPassword?: string; adminEmail: string };

export const companiesApi = {
  create: (data: CreateCompanyData) => api.post<CreatedCompany>('/companies', data),
  getAll: (params?: Record<string, string>) =>
    api.get<CompaniesResponse>('/companies', { params }),
  getOne: (id: string) => api.get<Company>(`/companies/${id}`),
  update: (id: string, data: Partial<UpdateCompanyData>) => api.put<Company>(`/companies/${id}`, data),
  delete: (id: string) => api.delete(`/companies/${id}`),
};
