import api from './axios';
import type { PlanData } from './subscriptions';
export const onboardingApi = {
  plans: () => api.get<PlanData[]>('/onboarding/plans'),
  checkout: (data: any) => api.post<{ registrationId: string; orderId: string; amount: number; currency: string; keyId: string; provider: 'RAZORPAY' | 'PAYU'; redirectUrl?: string }>('/onboarding/checkout', data),
  trial: (data: any) => api.post<{ registrationId: string; status: string; message: string }>('/onboarding/trial', data),
  status: (id: string) => api.get<{ status: string }>(`/onboarding/checkout/${id}`),
  resendVerification: (id: string) => api.post(`/onboarding/checkout/${id}/resend-verification`),
  verifyEmail: (token: string) => api.post('/onboarding/verify-email', { token }),
};
