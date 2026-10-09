import { randomBytes } from 'node:crypto';

/** Prefixed, time-sortable, collision-safe id (matches the `prefix_...` style the frontend already uses). */
export const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}${randomBytes(5).toString('hex')}`;
