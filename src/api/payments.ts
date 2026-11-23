import api from './axios';
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED' | 'REFUNDED' | 'NOT_RECORDED';
export interface Payment { id: string; companyId?: string; company?: { name: string; companyCode?: string }; subscriptionId?: string; source: 'OFFLINE' | 'RAZORPAY' | 'MANUAL'; registrationId?: string; registration?: { companyName: string; adminName: string; adminEmail: string; status: string }; status: PaymentStatus; plan: string; billingCycle: string; amount: number; currency: string; paidAt?: string; reference?: string; razorpayOrderId?: string; razorpayPaymentId?: string; notes?: string; createdAt: string; }
export const paymentsApi = {
  getAll: (params?: Record<string, string>) => api.get<{ payments: Payment[]; pagination: { total: number; page: number; totalPages: number } }>('/payments', { params }),
  markRegistrationPaid: (registrationId: string, body: { reference?: string; note?: string }) => api.post<{ companyId: string; adminEmail: string }>(`/registrations/${registrationId}/mark-paid`, body),
  mine: () => api.get<Payment[]>('/payments/mine'),
};
