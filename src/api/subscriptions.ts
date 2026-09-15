import api from './axios';

export interface ModuleCatalogItem { id: string; key: string; name: string; description?: string; category?: string; routeKey?: string; status?: string; actions?: string[]; isCore?: boolean; planSelectable?: boolean; sortOrder?: number }
export interface PlanVersion {
  id: string; version: number; name: string; type: string; currency: string;
  pricing: { monthly: number; annual: number };
  trial: { enabled: boolean; days: number };
  moduleIds: Array<string | ModuleCatalogItem>;
  limits: { employees: number; branches: number; storageGB: number; apiRequests?: number };
  features: string[]; publishedAt: string; publishedBy?: string;
}
export interface PlanDraftRecord {
  baseVersionId?: string;
  name: string;
  pricing: { monthly: number; annual: number };
  trial: { enabled: boolean; days: number };
  moduleIds: Array<string | ModuleCatalogItem>;
  limits: { employees: number; branches: number; storageGB: number; apiRequests?: number };
  features: string[];
  revision: number;
  updatedBy?: string;
  updatedAt: string;
}
export interface PlanData {
  id: string; name: string; type: string; status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  price: number; annualPrice: number; maxUsers: number; maxBranches: number; storageGB: number;
  apiRequests?: number;
  trialEnabled: boolean; defaultTrialDays: number; moduleIds: Array<string | ModuleCatalogItem>;
  features: string[]; currentVersionId?: PlanVersion; draft?: PlanDraftRecord;
  hasUnpublishedChanges?: boolean; draftRevision?: number; draftUpdatedAt?: string;
  versionCount?: number; activeSubscriptionCount?: number;
}
export interface Subscription {
  id: string; companyId: string; planId?: string; planVersionId?: string; plan: string; billingCycle: string; amount: number;
  startDate: string; endDate: string; status: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELLED';
  trialEndsAt?: string; currentPeriodEnd?: string; graceEndsAt?: string; suspensionReason?: string;
  isActive: boolean; cancelAtPeriodEnd?: boolean; company: { id: string; name: string; companyCode?: string; industry?: string; plan: string };
}
export interface SubscriptionsResponse {
  subscriptions: Subscription[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
  stats: { monthlyRevenue: number; active: number; trial: number; pastDue: number; suspended: number; expiringSoon: number };
}
export interface RevenueTrendPoint { month: string; revenue: number }
export interface PlanDraft {
  name: string; type: string; price: number; annualPrice: number; maxUsers: number; maxBranches: number;
  storageGB: number; apiRequests?: number; trialEnabled: boolean; defaultTrialDays: number; moduleIds: string[]; features: string[];
}
export const subscriptionsApi = {
  getRevenueTrend: () => api.get<RevenueTrendPoint[]>('/subscriptions/revenue-trend'),
  getAll: (params?: Record<string, string>) => api.get<SubscriptionsResponse>('/subscriptions', { params }),
  getPlans: () => api.get<PlanData[]>('/subscriptions/plans'),
  getPlan: (id: string) => api.get<{ plan: PlanData; versions: PlanVersion[] }>(`/subscriptions/plans/${id}`),
  getModuleCatalog: () => api.get<ModuleCatalogItem[]>('/subscriptions/plans/modules/catalog'),
  createPlan: (data: Partial<PlanDraft> & Pick<PlanDraft, 'name' | 'type' | 'price' | 'maxUsers'>) => api.post<PlanData>('/subscriptions/plans', data),
  updatePlan: (id: string, data: Partial<PlanDraft> & { draftRevision: number }) => api.put<PlanData>(`/subscriptions/plans/${id}`, data),
  publishPlan: (id: string, reason: string, draftRevision: number) => api.post<PlanVersion>(`/subscriptions/plans/${id}/publish`, { reason, draftRevision }),
  discardPlanDraft: (id: string, draftRevision: number, reason = 'Discarded from the plan builder') => api.post<PlanData>(`/subscriptions/plans/${id}/discard-draft`, { draftRevision, reason }),
  suspend: (id: string, reason: string) => api.post(`/subscriptions/${id}/suspend`, { reason, suspensionReason: 'MANUAL' }),
  cancel: (id: string, reason: string) => api.post(`/subscriptions/${id}/cancel`, { reason }),
  deletePlan: (id: string, reason: string) => api.delete(`/subscriptions/plans/${id}`, { data: { reason } }),
};
