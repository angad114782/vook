import api from './axios';
import { withBotProof } from '../lib/botProof';
import type { PlanData } from './subscriptions';

export interface CheckoutRegistrationData {
  company: { name: string; email?: string };
  admin: { name: string; email: string; mobile: string; password: string };
  plan: string;
  billingCycle: 'Monthly' | 'Annual';
}

export interface CheckoutOrder {
  registrationId: string;
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  provider?: string;
}

export const onboardingApi = {
  plans: () => api.get<PlanData[]>('/onboarding/plans'),
  checkout: (data: CheckoutRegistrationData) => withBotProof((botProof) => api.post<CheckoutOrder>('/onboarding/checkout', { ...data, botProof })),
  requestMobileOtp: (mobile: string, channel?: 'WHATSAPP' | 'SMS') => withBotProof((botProof) => api.post<{ channel: string; expiresInSeconds: number; resendAfterSeconds: number; devOtp?: string }>('/auth/register-otp/request', { mobile, channel, botProof })),
  verifyMobileOtp: (mobile: string, code: string) => api.post<{ verified: boolean }>('/auth/register-otp/verify', { mobile, code }),
  status: (id: string) => api.get<{ status: string; provider?: string; provisioned?: boolean }>(`/onboarding/checkout/${id}`),
  resendVerification: (id: string) => api.post(`/onboarding/checkout/${id}/resend-verification`),
  verifyEmail: (token: string) => api.post('/onboarding/verify-email', { token }),
};
