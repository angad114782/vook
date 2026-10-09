import api from './axios';

export type Biometric = 'FACE' | 'FINGERPRINT';
export type ConnectionMode = 'CLOUD_API' | 'LOCAL_BRIDGE' | 'DEVICE_PUSH' | 'MOBILE';
export interface ProviderField { key: string; label: string; required: boolean; secret?: boolean; placeholder?: string }
export interface DeviceProvider { id: string; key: string; name: string; mode: ConnectionMode; biometrics: Biometric[]; description: string; fields: ProviderField[]; builtIn: boolean }
export interface DeviceConnection {
  id: string; providerKey: string; displayName: string; connectionMode: ConnectionMode; biometrics: Biometric[];
  status: 'DRAFT' | 'TESTED' | 'ACTIVE' | 'ERROR' | 'DISABLED'; publicConfig: Record<string, string | number | boolean>;
  deviceSerials: string[]; deviceCount?: number; companyCount?: number; availability?: { mode: 'ALL' | 'SELECTED'; companyIds: string[] }; usage?: ConnectionUsage[]; secretConfigured: boolean; apiKeyHint?: string; lastTestedAt?: string; lastErrorCode?: string | null;
}
export interface ConnectionUsage { companyId: string; companyName: string; devices: number; active: number; lastEventAt: string | null }
export interface ConnectionInput {
  providerKey: string; displayName: string; biometrics: Biometric[]; publicConfig: Record<string, string>;
  secrets: Record<string, string>; deviceSerials: string[];
}
export interface ProviderInput { key: string; name: string; mode: ConnectionMode; biometrics: Biometric[]; description: string; fields: Array<{ key: string; label: string; required: boolean }> }

/** Any vendor, any connection type, face / fingerprint / both: the platform admin manages the catalogue and the connections here. */
export const deviceApi = {
  list: () => api.get<{ providers: DeviceProvider[]; connections: DeviceConnection[]; companies: Array<{ id: string; name: string; companyCode?: string }> }>('/attendance-integrations').then((r) => r.data),
  addProvider: (input: ProviderInput) => api.post<DeviceProvider>('/attendance-providers', input).then((r) => r.data),
  updateProvider: (key: string, input: ProviderInput) => api.put<DeviceProvider>(`/attendance-providers/${key}`, input).then((r) => r.data),
  removeProvider: (key: string) => api.delete(`/attendance-providers/${key}`),
  saveConnection: (id: string | null, input: ConnectionInput) => (id ? api.put<DeviceConnection>(`/attendance-integrations/${id}`, input) : api.post<DeviceConnection>('/attendance-integrations', input)).then((r) => r.data),
  act: (id: string, action: 'test' | 'activate' | 'disable') => api.post<DeviceConnection>(`/attendance-integrations/${id}/${action}`).then((r) => r.data),
  quickSetup: (input: { providerKey?: string; name?: string; biometrics?: Biometric[]; mode?: ConnectionMode; fields?: Array<{ label: string; required: boolean }>; publicConfig?: Record<string, string>; secrets: Record<string, string> }) => api.post<DeviceConnection>('/attendance-integrations/quick', input).then((r) => r.data),
  setAvailability: (id: string, input: { mode: 'ALL' | 'SELECTED'; companyIds: string[] }) => api.put<DeviceConnection>(`/attendance-integrations/${id}/availability`, input).then((r) => r.data),
  removeConnection: (id: string) => api.delete(`/attendance-integrations/${id}`),
};

export type DeviceAccess = 'ALL' | 'BRANCH' | 'SELECTED';
export interface CompanyDevice {
  modelNo: string;
  connectionState: 'OK' | 'PAUSED' | 'NO_ACCESS' | 'REMOVED';
  access: DeviceAccess; employeeIds: string[]; employeeCount: number;
  id: string; name: string; serial: string; branchId: string | null; branchName: string | null; connectionId: string; connectionName: string; providerName: string | null;
  biometrics: Biometric[]; status: 'ACTIVE' | 'DISABLED'; lastEventAt: string | null; eventCount: number; punchesToday: number; working: boolean; notes?: string;
}
export interface UsableConnection { id: string; displayName: string; providerName: string; connectionMode: ConnectionMode; biometrics: Biometric[] }
export interface DeviceEvent { id: string; type: 'CHECK_IN' | 'CHECK_OUT'; modality: Biometric; occurredAt: string; employee: { employeeId: string; name: string } | null }

/** A company registers each physical machine it owns (any number, any branch) on a connection the platform admin switched on. */
export const companyDeviceApi = {
  list: () => api.get<{ needsAttention: number; companyCode: string | null; peopleNames: Record<string, string>; devices: CompanyDevice[]; connections: UsableConnection[]; branches: Array<{ id: string; name: string }>; summary: { total: number; active: number; seenToday: number; punchesToday: number; limit: number | null } }>('/attendance-devices').then((r) => r.data),
  add: (input: { connectionId: string; serial: string; modelNo?: string; name: string; branchId: string | null; biometrics: Biometric[]; notes?: string; access: DeviceAccess; employeeIds: string[] }) => api.post<CompanyDevice>('/attendance-devices', input).then((r) => r.data),
  update: (id: string, input: Partial<{ name: string; modelNo: string; branchId: string | null; biometrics: Biometric[]; notes: string; status: 'ACTIVE' | 'DISABLED'; access: DeviceAccess; employeeIds: string[] }>) => api.put<CompanyDevice>(`/attendance-devices/${id}`, input).then((r) => r.data),
  remove: (id: string) => api.delete(`/attendance-devices/${id}`),
  events: (id: string) => api.get<DeviceEvent[]>(`/attendance-devices/${id}/events`).then((r) => r.data),
};

export interface PersonOption { id: string; employeeId: string; name: string }
export const searchPeople = (search: string) => api.get<PersonOption[]>('/employees', { params: { search, limit: 30 } }).then((r) => r.data);
