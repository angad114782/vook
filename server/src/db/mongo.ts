import { MongoClient, type Collection, type Db } from 'mongodb';

/** Every document is keyed by a string `_id` (our public id). */
export type Doc = { _id: string; [key: string]: any };

let client: MongoClient | undefined;
let database: Db | undefined;

export async function connectDb(uri: string, dbName: string): Promise<Db> {
  if (database) return database;
  client = new MongoClient(uri, { maxPoolSize: 50, minPoolSize: 2, serverSelectionTimeoutMS: 10_000, socketTimeoutMS: 30_000, appName: 'vook-api' });
  await client.connect();
  database = client.db(dbName);
  return database;
}

export const db = (): Db => {
  if (!database) throw new Error('Database is not connected yet.');
  return database;
};

export const coll = (name: string): Collection<Doc> => db().collection<Doc>(name);

/** Runs `fn` in a multi-document transaction (all-or-nothing). Requires a replica set / Atlas. */
export async function withTransaction<T>(fn: (session: import('mongodb').ClientSession) => Promise<T>): Promise<T> {
  if (!client) throw new Error('Database is not connected yet.');
  const session = client.startSession();
  try {
    let result!: T;
    await session.withTransaction(async () => { result = await fn(session); });
    return result;
  } finally { await session.endSession(); }
}

export async function closeDb() {
  await client?.close();
  client = undefined;
  database = undefined;
}

export const pingDb = async () => (await db().command({ ping: 1 })).ok === 1;
