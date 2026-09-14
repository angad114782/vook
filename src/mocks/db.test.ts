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
});
