import api from './axios';

export interface RoleDefinition {
  id: string; companyId: string; key: string; name: string; description?: string;
  kind: 'SYSTEM' | 'TEMPLATE' | 'CUSTOM'; locked: boolean; permissions: string[]; revision: number;
}
export interface RoleAssignment {
  id: string; _id?: string; companyId: string; roleDefinitionId: string; scopeType: 'COMPANY' | 'DEPARTMENT' | 'TEAM' | 'SELF';
  scopeId?: string | null; isPrimary: boolean; role: string; roleName: string; permissions: string[];
  userId: { id: string; _id?: string; name: string; email: string };
}

export const organizationApi = {
  getTeams: <T>() => api.get<T[]>('/teams'),
  getDesignations: <T>() => api.get<T[]>('/company-admin/designations'),
  createDepartment: (data: Record<string, unknown>) => api.post('/company-admin/departments', data),
  updateDepartment: (id: string, data: Record<string, unknown>) => api.patch(`/company-admin/departments/${id}`, data),
  createDesignation: (data: Record<string, unknown>) => api.post('/company-admin/designations', data),
  updateDesignation: (id: string, data: Record<string, unknown>) => api.patch(`/company-admin/designations/${id}`, data),
  getRoleAssignments: <T>() => api.get<T[]>('/company-admin/role-assignments'),
  createRoleAssignment: (data: Record<string, unknown>) => api.post('/company-admin/role-assignments', data),
  deleteRoleAssignment: (id: string) => api.delete(`/company-admin/role-assignments/${id}`),
  getRoleDefinitions: () => api.get<RoleDefinition[]>('/role-definitions'),
  createRoleDefinition: (data: { name: string; description?: string; permissions: string[] }) => api.post<RoleDefinition>('/role-definitions', data),
  updateRoleDefinition: (id: string, data: { name?: string; description?: string; permissions?: string[] }) => api.put<RoleDefinition>(`/role-definitions/${id}`, data),
  deleteRoleDefinition: (id: string) => api.delete(`/role-definitions/${id}`),
  importEmployees: (rows: Record<string, unknown>[]) => api.post('/company-admin/employees/import', { rows }, { validateStatus: (status) => status >= 200 && status < 300 }),
};
