import { coll } from '../db/mongo.ts';
import { insertMany, type Row } from '../db/repo.ts';
import { logger } from '../lib/logger.ts';
import { createMockSeed } from './mockSeed.ts';

/**
 * The few things a brand-new production database needs before the first company can be created:
 * the module catalogue, the starter plans, the role templates every company is cloned from, and platform settings.
 * Runs once (only while the module catalogue is empty), so anything the Super Admin edits or removes later stays that way.
 * It adds no companies, no employees and no demo accounts.
 */
export async function ensurePlatformBase(): Promise<boolean> {
  if (await coll('modules').countDocuments({}, { limit: 1 })) return false;
  const state = createMockSeed(new Date()) as unknown as Record<string, Row[]>;
  await insertMany('modules', state.modules!, 'module');
  await insertMany('planVersions', state.planVersions!, 'planversion');
  await insertMany('plans', state.plans!.map((p) => ({ ...p, currentVersionId: (p.currentVersionId as Row | string | null | undefined && typeof p.currentVersionId === 'object' ? (p.currentVersionId as Row).id : p.currentVersionId) ?? null })), 'plan');
  const templates = state.roleDefinitions!.filter((r) => r.companyId === 'company_northstar' && r.kind !== 'CUSTOM')
    .map((r) => ({ ...r, id: `tpl_${String(r.key).toLowerCase()}`, _id: undefined, companyId: 'platform' }));
  await insertMany('roleDefinitions', templates, 'tpl');
  const settings = state.settings as unknown as Row;
  await coll('platformSettings').updateOne({ _id: 'platform' as never }, { $setOnInsert: { ...settings, general: { platformName: 'Vook', platformUrl: '', supportEmail: '' }, updatedAt: new Date().toISOString() } }, { upsert: true });
  logger.info({ modules: state.modules!.length, plans: state.plans!.length, roles: templates.length }, 'platform base data created');
  return true;
}
