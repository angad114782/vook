import dns from 'node:dns/promises';
import net from 'node:net';
import { isProd } from '../config/env.ts';
import { AppError } from './errors.ts';

const isPrivateAddress = (ip: string) => net.isIP(ip) === 4
  ? /^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip)
  : /^(::1|fc|fd|fe80)/i.test(ip);
/** SSRF guard: a configured host must resolve to a public address (loopback is allowed only in development). */
export async function assertPublicHost(host: string) {
  const addresses = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true });
  if (isProd && addresses.some((a) => isPrivateAddress(a.address))) throw new AppError(422, 'HOST_NOT_ALLOWED', 'That server address is not allowed.');
}

