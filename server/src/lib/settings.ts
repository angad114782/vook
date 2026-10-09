import { byId, type Row } from '../db/repo.ts';
import { TtlCache } from './cache.ts';

const cache = new TtlCache<Row>(10_000, 2);
/** Platform-wide settings (maintenance, IP rules, …), cached briefly because nearly every request reads them. */
export const platformSettings = () => cache.wrap('s', async () => (await byId('platformSettings', 'platform')) ?? {});
export const invalidateSettings = () => cache.clear();
