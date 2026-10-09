import { isProd } from '../config/env.ts';
import { find } from '../db/repo.ts';
import { AppError } from './errors.ts';
import { logger } from './logger.ts';
import { integrationSecrets } from '../payments/provider.ts';

export type Channel = 'WHATSAPP' | 'SMS';

/** Messages that were "sent" without a real provider (development and tests only). */
export const devMessages: Array<{ channel: Channel; to: string; code: string; at: string }> = [];

async function activeProviders() {
  const rows = await find('integrations', { providerKey: { $in: ['WHATSAPP', 'TWILIO'] }, status: 'ACTIVE' });
  return { whatsapp: rows.find((r) => r.providerKey === 'WHATSAPP') ?? null, sms: rows.find((r) => r.providerKey === 'TWILIO') ?? null };
}

/** Which ways of receiving a sign-in code are available right now. Development offers both so the flow can be tried. */
export async function availableChannels(): Promise<Channel[]> {
  const { whatsapp, sms } = await activeProviders();
  const channels: Channel[] = [];
  if (whatsapp || !isProd) channels.push('WHATSAPP');
  if (sms || !isProd) channels.push('SMS');
  return channels;
}

const e164 = (mobileKey: string) => `91${mobileKey}`; // India-first; widen when more countries are supported

async function post(url: string, init: RequestInit) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`provider ${res.status}`);
}

/** Sends the one-time code. Real providers when active; a logged stand-in in development; a clear error in production. */
export async function sendOtp(input: { channel: Channel; mobileKey: string; code: string }): Promise<'PROVIDER' | 'DEV'> {
  const { whatsapp, sms } = await activeProviders();
  if (input.channel === 'WHATSAPP' && whatsapp) {
    const secrets = integrationSecrets(whatsapp);
    const template = String(whatsapp.publicConfig?.otpTemplate || 'vook_login_otp');
    await post(`https://graph.facebook.com/v19.0/${encodeURIComponent(String(whatsapp.publicConfig.phoneNumberId))}/messages`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secrets.accessToken}` },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: e164(input.mobileKey), type: 'template', template: { name: template, language: { code: 'en' }, components: [{ type: 'body', parameters: [{ type: 'text', text: input.code }] }, { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: input.code }] }] } }),
    });
    return 'PROVIDER';
  }
  if (input.channel === 'SMS' && sms) {
    const secrets = integrationSecrets(sms);
    const sid = String(sms.publicConfig.accountSid);
    await post(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${Buffer.from(`${sid}:${secrets.authToken}`).toString('base64')}` },
      body: new URLSearchParams({ From: String(sms.publicConfig.fromNumber), To: `+${e164(input.mobileKey)}`, Body: `${input.code} is your Vook sign-in code. It expires soon. Do not share it with anyone.` }),
    });
    return 'PROVIDER';
  }
  if (isProd) throw new AppError(503, 'OTP_UNAVAILABLE', 'Sign-in codes are not available right now. Please sign in with your password.');
  devMessages.unshift({ channel: input.channel, to: input.mobileKey, code: input.code, at: new Date().toISOString() });
  devMessages.length = Math.min(devMessages.length, 50);
  logger.info({ channel: input.channel, to: `******${input.mobileKey.slice(-4)}` }, 'sign-in code created (development stand-in, not actually sent)');
  return 'DEV';
}

