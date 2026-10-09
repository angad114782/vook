import api from './axios';

/** Pick-lists that live in the database (document categories, expense categories, support topics, employment types, industries). */
export type LookupType = 'DOCUMENT_CATEGORY' | 'EXPENSE_CATEGORY' | 'SUPPORT_CATEGORY' | 'EMPLOYMENT_TYPE' | 'INDUSTRY';
export interface LookupList { type: LookupType; items: string[]; canManage: boolean }

export const lookupApi = {
  list: (type: LookupType) => api.get<LookupList>(`/lookups/${type}`).then((r) => r.data),
  add: (type: LookupType, value: string) => api.post<{ value: string; existed?: boolean }>(`/lookups/${type}`, { value }).then((r) => r.data),
  remove: (type: LookupType, value: string) => api.delete(`/lookups/${type}/${encodeURIComponent(value)}`),
};
