import type { RequestHandler } from 'express';
import { AppError } from '../lib/errors.ts';
import { invalidateSettings, platformSettings } from '../lib/settings.ts';

export { invalidateSettings };

/** When the platform admin switches maintenance on, everyone except platform admins gets a friendly "back soon" message. */
export const maintenanceGate: RequestHandler = async (req, _res, next) => {
  const user = req.ctx.user;
  if (!user || user.role === 'SUPER_ADMIN' || req.path.startsWith('/auth/')) return next();
  const system = (await platformSettings()).system ?? {};
  if (system.maintenance) return next(new AppError(503, 'MAINTENANCE', system.maintenanceMsg || 'Vook is being updated and will be back in a few minutes.'));
  next();
};
