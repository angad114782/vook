import api from './axios';

export interface AppModule {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: string;
  routeKey: string;
  actions: string[];
  isCore: boolean;
  planSelectable: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  isEnabled: boolean | null;
  createdAt: string;
}

export interface PermissionItem {
  permission: string;
  isGranted: boolean;
}

export interface PermissionsResponse {
  role: string | null;
  permissions: Record<string, PermissionItem[]>;
}

export const modulesApi = {
  getModules: (companyId?: string) =>
    api.get<{ modules: AppModule[] }>('/modules', { params: companyId ? { companyId } : {} }),

  getCompanies: () =>
    api.get<{ id: string; name: string; plan: string }[]>('/modules/companies'),

  toggleModule: (companyId: string, moduleId: string, isEnabled: boolean, reason: string, expiresAt?: string) =>
    api.put('/modules/toggle', { companyId, moduleId, isEnabled, reason, expiresAt: expiresAt || null }),

  createOverride: (data: { companyId: string; effect: 'GRANT' | 'DENY' | 'SET_LIMIT'; moduleId?: string; limitKey?: 'employees' | 'branches' | 'storageGB' | 'apiRequests'; limitValue?: number; reason: string; expiresAt?: string }) =>
    api.post('/entitlement-overrides', data),

  getPermissions: (role?: string) =>
    api.get<PermissionsResponse>('/modules/permissions', { params: role ? { role } : {} }),

  updatePermission: (role: string, permission: string, isGranted: boolean) =>
    api.put('/modules/permissions', { role, permission, isGranted }),
};
