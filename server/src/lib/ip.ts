import type { Request } from 'express';

/** The caller's address as Express resolved it (honours TRUST_PROXY), without the IPv4-in-IPv6 prefix. */
export const clientIp = (req: Request): string => (req.ip ?? '').replace(/^::ffff:/, '');

const v4 = (ip: string) => { const p = ip.split('.').map(Number); return p.length === 4 && p.every((n) => Number.isInteger(n) && n >= 0 && n <= 255) ? ((p[0]! << 24) | (p[1]! << 16) | (p[2]! << 8) | p[3]!) >>> 0 : null; };

/** Matches an address against exact IPs and IPv4 CIDR ranges like 203.0.113.0/24. */
export function ipMatches(ip: string, rules: string[]): boolean {
  const addr = v4(ip);
  return rules.some((rule) => {
    const [base, bits] = rule.trim().split('/');
    if (!base) return false;
    if (bits === undefined) return base === ip;
    const b = v4(base), len = Number(bits);
    if (addr === null || b === null || !Number.isInteger(len) || len < 0 || len > 32) return false;
    const mask = len === 0 ? 0 : (~0 << (32 - len)) >>> 0;
    return (addr & mask) === (b & mask);
  });
}

export const IP_RULE = /^(\d{1,3}(\.\d{1,3}){3}(\/\d{1,2})?|[0-9a-fA-F:]{2,39})$/;

/** Last 10 digits, the same key the employee directory uses. Returns undefined when it is not a usable number. */
export const mobileKeyOf = (input: unknown): string | undefined => {
  const digits = String(input ?? '').replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : undefined;
};
export const looksLikeEmail = (v: string) => v.includes('@');
