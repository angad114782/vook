import { createHmac, randomBytes } from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export const newSecret = () => {
  const bytes = randomBytes(20);
  let bits = '';
  for (const b of bytes) bits += b.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) out += ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  return out;
};

const decode = (secret: string) => {
  let bits = '';
  for (const c of secret.replace(/=+$/, '').toUpperCase()) bits += ALPHABET.indexOf(c).toString(2).padStart(5, '0');
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
};

export const totpAt = (secret: string, time = Date.now(), step = 30, digits = 6) => {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(time / 1000 / step)));
  const hmac = createHmac('sha1', decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1]! & 0xf;
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits;
  return String(code).padStart(digits, '0');
};

/** Accepts the current code and one step either side to tolerate clock drift. */
export const verifyTotp = (secret: string, code: unknown) =>
  typeof code === 'string' && /^\d{6}$/.test(code) && [-1, 0, 1].some((w) => totpAt(secret, Date.now() + w * 30_000) === code);

export const otpauthUrl = (email: string, secret: string) =>
  `otpauth://totp/Vook:${encodeURIComponent(email)}?secret=${secret}&issuer=Vook`;
