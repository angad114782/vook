import api from './axios';

export interface SearchResult {
  id: string; type: 'company' | 'employee' | 'user' | 'document'; name: string;
  subtitle?: string; companyCode?: string; employeeId?: string; email?: string;
  role?: string; companyId?: string; companyName?: string;
}
export interface GlobalSearchResponse {
  query: string; companies: SearchResult[]; employees: SearchResult[];
  users: SearchResult[]; documents: SearchResult[];
}

export const searchApi = {
  global: (q: string, signal?: AbortSignal) => api.get<GlobalSearchResponse>('/search', { params: { q }, signal }),
};
