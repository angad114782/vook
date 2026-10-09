import { createHmac, timingSafeEqual } from 'node:crypto';
import { isProd } from '../config/env.ts';
import { findOne } from '../db/repo.ts';
import { AppError } from '../lib/errors.ts';
import { newId } from '../lib/ids.ts';
import { decryptSecret } from '../lib/secrets.ts';

/** Payment gateway port. The application depends on this interface only, so adding PayU or Stripe is one new class. */
export interface PaymentProvider {
  name: 'RAZORPAY';
  /** True when the provider settles instantly (development stand-in). Real gateways settle later via webhook. */
  autoSettle: boolean;
  createOrder(input: { amountMinor: number; currency: string; receipt: string; notes?: Record<string, string> }): Promise<{ orderId: string; keyId: string }>;
  verifyWebhook(rawBody: Buffer, signature: string | undefined): boolean;
}

export const integrationSecrets = (row: { secrets?: Record<string, string> } | null) =>
  Object.fromEntries(Object.entries(row?.secrets ?? {}).map(([k, v]) => [k, decryptSecret(v)]));

class RazorpayProvider implements PaymentProvider {
  name = 'RAZORPAY' as const;
  autoSettle = false;
  constructor(private keyId: string, private keySecret: string, private webhookSecret: string) {}
  async createOrder({ amountMinor, currency, receipt, notes }: Parameters<PaymentProvider['createOrder']>[0]) {
    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST', signal: AbortSignal.timeout(10_000),
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64')}` },
      body: JSON.stringify({ amount: amountMinor, currency, receipt: receipt.slice(0, 40), notes }),
    });
    if (!res.ok) throw new AppError(502, 'PAYMENT_PROVIDER_ERROR', 'The payment service could not start the checkout. Please try again in a moment.');
    const order = (await res.json()) as { id: string };
    return { orderId: order.id, keyId: this.keyId };
  }
  verifyWebhook(rawBody: Buffer, signature: string | undefined) {
    if (!signature) return false;
    const expected = createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex');
    const a = Buffer.from(expected), b = Buffer.from(signature);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}

/** Local stand-in so the whole checkout flow works without gateway credentials. Never used in production. */
class DevProvider implements PaymentProvider {
  name = 'RAZORPAY' as const;
  autoSettle = true;
  async createOrder() { return { orderId: newId('order_dev'), keyId: 'dev_key' }; }
  verifyWebhook() { return false; }
}

export async function getPaymentProvider(): Promise<PaymentProvider> {
  const row = await findOne('integrations', { providerKey: 'RAZORPAY', status: 'ACTIVE' });
  if (row) {
    const secrets = integrationSecrets(row);
    if (row.publicConfig?.keyId && secrets.keySecret) return new RazorpayProvider(row.publicConfig.keyId, secrets.keySecret, secrets.webhookSecret ?? '');
  }
  if (!isProd) return new DevProvider();
  throw new AppError(503, 'PAYMENTS_NOT_CONFIGURED', 'Online payments are not available right now. Please contact support.');
}
