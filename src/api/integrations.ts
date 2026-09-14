import api from './axios';
export interface IntegrationField { key: string; label: string; required: boolean }
export interface Integration {
  id?: string; category: string; providerKey: string; displayName: string; available: boolean;
  status: 'NOT_CONFIGURED' | 'DRAFT' | 'ACTIVE' | 'ERROR' | 'UNAVAILABLE';
  publicFields: IntegrationField[]; secretFields: IntegrationField[];
  publicConfig: Record<string, string | number | boolean>; secretConfigured: boolean;
  pendingConfiguration: boolean; lastTestedAt?: string; lastErrorCode?: string;
}
export const integrationsApi = {
  list: () => api.get<Integration[]>('/integrations'),
  save: (providerKey: string, data: { publicConfig: Record<string, unknown>; secrets: Record<string, string>; reason?: string }) => api.put(`/integrations/${providerKey}`, data),
  test: (providerKey: string) => api.post(`/integrations/${providerKey}/test`),
  activate: (providerKey: string, reason: string) => api.post(`/integrations/${providerKey}/activate`, { reason }),
  disable: (providerKey: string, reason: string) => api.post(`/integrations/${providerKey}/disable`, { reason }),
};
export const auditApi = { list: (params?: Record<string, string>) => api.get('/audit', { params }) };
