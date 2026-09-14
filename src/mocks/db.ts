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
  if (stored?.schemaVersion === MOCK_SCHEMA_VERSION) return stored;
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
