import { isMockMode } from '../config/runtime';

interface CheckoutOptions {
  provider?: 'RAZORPAY' | 'PAYU';
  keyId?: string;
  amount?: number;
  currency?: string;
  orderId?: string;
  description: string;
  redirectUrl?: string;
}

declare global { interface Window { Razorpay?: new (options: Record<string, unknown>) => { open: () => void } } }

const loadRazorpay = () => new Promise<boolean>((resolve) => {
  if (window.Razorpay) { resolve(true); return; }
  const script = document.createElement('script');
  script.src = 'https://checkout.razorpay.com/v1/checkout.js';
  script.onload = () => resolve(true);
  script.onerror = () => resolve(false);
  document.body.appendChild(script);
});

export async function openPaymentCheckout(options: CheckoutOptions): Promise<void> {
  if (isMockMode) {
    await new Promise((resolve) => window.setTimeout(resolve, 350));
    return;
  }
  if (options.provider === 'PAYU') {
    if (!options.redirectUrl) throw new Error('The PayU redirect URL was not returned by the API.');
    window.location.assign(options.redirectUrl);
    return;
  }
  if (!options.orderId || !options.keyId || !await loadRazorpay() || !window.Razorpay) {
    throw new Error('Could not open the secure payment checkout.');
  }
  await new Promise<void>((resolve, reject) => {
    new window.Razorpay!({
      key: options.keyId,
      amount: options.amount,
      currency: options.currency,
      name: 'VOOK',
      description: options.description,
      order_id: options.orderId,
      theme: { color: '#0d7470' },
      handler: () => resolve(),
      modal: { ondismiss: () => reject(new Error('Payment checkout was dismissed.')) },
    }).open();
  });
}
