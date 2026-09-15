import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { getMockState, resetMockState, updateMockState } from './db';

describe('persistent mock database', () => {
  beforeEach(async () => { await resetMockState(); });

  it('persists mutations and resets to the seed', async () => {
    await updateMockState((state) => { state.companies[0].name = 'Changed demo company'; });
    expect((await getMockState()).companies[0].name).toBe('Changed demo company');
    const reset = await resetMockState();
    expect(reset.companies[0].name).toBe('Northstar Manufacturing Pvt Ltd');
  });

  it('adds newly shipped integration providers to an existing demo database', async () => {
    await updateMockState((state) => {
      state.integrations = state.integrations.filter((item) => item.providerKey !== 'WHATSAPP');
    });

    const migrated = await getMockState();
    expect(migrated.integrations.some((item) => item.providerKey === 'WHATSAPP')).toBe(true);
  });

  it('refreshes provider manifest fields without replacing saved configuration', async () => {
    await updateMockState((state) => {
      const whatsapp = state.integrations.find((item) => item.providerKey === 'WHATSAPP')!;
      whatsapp.publicFields = [{ key: 'graphApiVersion', label: 'Graph API version', required: false }];
      whatsapp.publicConfig = { phoneNumberId: 'saved-phone-id' };
    });

    const migrated = await getMockState();
    const whatsapp = migrated.integrations.find((item) => item.providerKey === 'WHATSAPP')!;
    expect(whatsapp.publicFields).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'businessAccountId', required: false }),
    ]));
    expect(whatsapp.publicConfig).toEqual({ phoneNumberId: 'saved-phone-id' });
  });
});
