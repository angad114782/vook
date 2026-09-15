import api from './axios';
import type { PlanData } from './subscriptions';

export interface CheckoutRegistrationData {
  company: { name: string; email?: string };
  admin: { name: string; email: string; password: string };
  plan: string;
  billingCycle: 'Monthly' | 'Annual';
}

export interface CheckoutOrder {
  registrationId: string;
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
}

export const onboardingApi = {
  plans: () => api.get<PlanData[]>('/onboarding/plans'),
  checkout: (data: CheckoutRegistrationData) => api.post<CheckoutOrder>('/onboarding/checkout', data),
  status: (id: string) => api.get<{ status: string }>(`/onboarding/checkout/${id}`),
  resendVerification: (id: string) => api.post(`/onboarding/checkout/${id}/resend-verification`),
  verifyEmail: (token: string) => api.post('/onboarding/verify-email', { token }),
};
