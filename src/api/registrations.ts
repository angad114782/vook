import api from './axios';

export type RegistrationStage = 'AWAITING_PAYMENT' | 'CHECKOUT_PENDING' | 'TRIAL' | 'ACTIVE' | 'PAID' | 'FAILED';

export interface RegistrationRow {
  id: string; companyName: string; adminName: string; adminEmail: string; adminMobile?: string | null; plan: string; billingCycle: string;
  amount: number | null; currency: string; provider: string; stage: RegistrationStage; paymentStatus: string | null;
  companyId: string | null; trialEndsAt: string | null; createdAt: string;
}

export const registrationsApi = {
  list: () => api.get<{ registrations: RegistrationRow[]; defaultTrialDays: number }>('/registrations'),
  startTrial: (id: string, days?: number) => api.post(`/registrations/${id}/start-trial`, { days }),
  markPaid: (id: string, body: { reference?: string }) => api.post(`/registrations/${id}/mark-paid`, body),
};
