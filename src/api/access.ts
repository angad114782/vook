import api from './axios';

export interface AccessSnapshot {
  role: string;
  permissions: string[];
  modules: Array<{ name: string; key?: string; isEnabled: boolean; source?: string }>;
  roles?: Array<{ role: string; scopeType: string; scopeId?: string; permissions: string[] }>;
  limits?: { employees: number; branches: number; storageGB: number; apiRequests?: number };
  subscription: {
    state: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELLED' | 'UNKNOWN';
    plan: string | null;
    trialEndsAt: string | null;
    currentPeriodEnd: string | null;
    gracePeriodEnd: string | null;
    daysRemaining: number | null;
    readOnly: boolean;
  } | null;
}

export const accessApi = {
  get: () => api.get<AccessSnapshot>('/auth/access'),
};
