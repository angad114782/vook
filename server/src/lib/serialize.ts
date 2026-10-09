import type { Row } from '../db/repo.ts';

/** Strips credentials and internal fields before a user row leaves the server. */
export const safeUser = (u: Row | null | undefined) => {
  if (!u) return u ?? null;
  const { passwordHash, totpSecret, pendingTotpSecret, failedLogins, lockedUntil, emailLower, mobileKey, ...rest } = u;
  return rest;
};

export const nowIso = () => new Date().toISOString();
export const today = () => new Date().toISOString().slice(0, 10);

/** Copies only the listed keys that are present on the input. */
export const pick = <T extends Row>(input: T, keys: readonly string[]): Row => {
  const out: Row = {};
  for (const k of keys) if (input[k] !== undefined) out[k] = input[k];
  return out;
};
