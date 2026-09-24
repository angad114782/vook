import { deleteDB, openDB, type DBSchema } from 'idb';
import { createMockSeed, MOCK_SCHEMA_VERSION, type MockState } from './seed';

const DB_NAME = 'vook-mock-v2';
const STATE_KEY = 'application';

interface MockDatabase extends DBSchema {
  state: { key: string; value: MockState };
  files: { key: string; value: Blob };
}

let databasePromise: ReturnType<typeof openDB<MockDatabase>> | undefined;
const database = () => {
  databasePromise ??= openDB<MockDatabase>(DB_NAME, MOCK_SCHEMA_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('state')) db.createObjectStore('state');
      if (!db.objectStoreNames.contains('files')) db.createObjectStore('files');
    },
  });
  return databasePromise;
};

export async function getMockState(): Promise<MockState> {
  const db = await database();
  const stored = await db.get('state', STATE_KEY);
  if (stored?.schemaVersion === MOCK_SCHEMA_VERSION) {
    // Provider definitions are platform catalog data, not user-created records.
    // Add newly shipped providers without wiping saved demo configuration.
    const seededState = createMockSeed();
    const seededIntegrations = seededState.integrations;
    stored.integrations ??= [];
    const storedProviderKeys = new Set(
      stored.integrations.map((item) => String(item.providerKey ?? item.key).toUpperCase()),
    );
    const missingIntegrations = seededIntegrations.filter(
      (item) => !storedProviderKeys.has(String(item.providerKey ?? item.key).toUpperCase()),
    );
    let catalogChanged = false;
    stored.integrations = stored.integrations.map((storedIntegration) => {
      const providerKey = String(storedIntegration.providerKey ?? storedIntegration.key).toUpperCase();
      const manifest = seededIntegrations.find(
        (item) => String(item.providerKey ?? item.key).toUpperCase() === providerKey,
      );
      if (!manifest) return storedIntegration;
      const catalogFields = ['displayName', 'category', 'available', 'publicFields', 'secretFields'] as const;
      if (catalogFields.some((field) => JSON.stringify(storedIntegration[field]) !== JSON.stringify(manifest[field]))) {
        catalogChanged = true;
      }
      return {
        ...storedIntegration,
        ...Object.fromEntries(catalogFields.map((field) => [field, structuredClone(manifest[field])])),
      };
    });
    if (missingIntegrations.length) {
      stored.integrations.push(...structuredClone(missingIntegrations));
      catalogChanged = true;
    }

    // Role definitions are seeded tenant configuration. Backfill definitions
    // introduced after an existing demo database was first created without
    // replacing custom roles or other user-generated state.
    const storedRoleDefinitionIds = new Set(
      (stored.roleDefinitions ?? []).map((item) => String(item.id)),
    );
    const missingRoleDefinitions = seededState.roleDefinitions.filter(
      (item) => !storedRoleDefinitionIds.has(String(item.id)),
    );
    if (missingRoleDefinitions.length) {
      stored.roleDefinitions = [
        ...(stored.roleDefinitions ?? []),
        ...structuredClone(missingRoleDefinitions),
      ];
      catalogChanged = true;
    }

    // Keep global notification queries working for demo databases created
    // before notifications were added to the seed.
    if (!stored.notifications) {
      stored.notifications = structuredClone(seededState.notifications);
      catalogChanged = true;
    }

    if (!stored.holidayCalendars) {
      stored.holidayCalendars = structuredClone(seededState.holidayCalendars);
      catalogChanged = true;
    }
    if (!stored.attendancePeriods) {
      stored.attendancePeriods = structuredClone(seededState.attendancePeriods);
      catalogChanged = true;
    }
    if (!stored.payrollCompliance) {
      stored.payrollCompliance = structuredClone(seededState.payrollCompliance);
      catalogChanged = true;
    }

    // Migrate the legacy demo payslip state into the production lifecycle
    // without replacing employee or user-created records.
    stored.payslips = (stored.payslips ?? []).map((payslip) => {
      if (payslip.status !== 'PROCESSED') return payslip;
      catalogChanged = true;
      return { ...payslip, status: payslip.paymentStatus === 'PAID' ? 'PAID' : 'PUBLISHED' };
    });

    // Seed additions should appear for existing demo sessions too. Keep
    // user-created comments intact while backfilling only new fixture rows.
    const storedComments = stored.comments ?? [];
    const storedCommentIds = new Set(storedComments.map((item) => String(item.id)));
    const missingComments = seededState.comments.filter(
      (item) => !storedCommentIds.has(String(item.id)),
    );
    if (missingComments.length) {
      storedComments.push(...structuredClone(missingComments));
      storedComments.sort(
        (left, right) =>
          new Date(String(left.createdAt ?? '')).getTime() -
          new Date(String(right.createdAt ?? '')).getTime(),
      );
      stored.comments = storedComments;
      catalogChanged = true;
    }

    if (catalogChanged) {
      await db.put('state', stored, STATE_KEY);
    }
    return stored;
  }
  const seed = createMockSeed();
  await db.put('state', seed, STATE_KEY);
  return seed;
}

export async function saveMockState(state: MockState): Promise<void> {
  const db = await database();
  await db.put('state', state, STATE_KEY);
}

export async function updateMockState<T>(mutate: (state: MockState) => T | Promise<T>): Promise<T> {
  const state = structuredClone(await getMockState());
  const result = await mutate(state);
  await saveMockState(state);
  return result;
}

export async function putMockFile(key: string, file: Blob): Promise<void> {
  const db = await database();
  await db.put('files', file, key);
}

export async function getMockFile(key: string): Promise<Blob | undefined> {
  const db = await database();
  return db.get('files', key);
}

export async function resetMockState(): Promise<MockState> {
  const db = await database();
  db.close();
  databasePromise = undefined;
  await deleteDB(DB_NAME);
  return getMockState();
}
