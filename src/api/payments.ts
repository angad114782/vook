import api from './axios';
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED' | 'REFUNDED' | 'NOT_RECORDED';
export interface Payment { id: string; companyId?: string; company?: { name: string; companyCode?: string }; subscriptionId?: string; source: 'OFFLINE' | 'RAZORPAY'; status: PaymentStatus; plan: string; billingCycle: string; amount: number; currency: string; paidAt?: string; reference?: string; razorpayOrderId?: string; razorpayPaymentId?: string; notes?: string; createdAt: string; }
export const paymentsApi = {
  getAll: (params?: Record<string, string>) => api.get<{ payments: Payment[]; pagination: { total: number; page: number; totalPages: number } }>('/payments', { params }),
  mine: () => api.get<Payment[]>('/payments/mine'),
};
