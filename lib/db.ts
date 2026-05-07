import { MongoClient, Db } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://terraadmin:FindingNemo%401@terraquest-cluster.global.mongocluster.cosmos.azure.com/?tls=true&authMechanism=SCRAM-SHA-256&retrywrites=false&maxIdleTimeMS=120000';

const DB_NAME = process.env.MONGODB_DB || 'terraquest';

let cachedDb: Db | null = null;

export async function getDb(): Promise<Db> {
  if (cachedDb) return cachedDb;

  const client = await MongoClient.connect(MONGODB_URI, {
    maxPoolSize: 10,
    minPoolSize: 1,
  });

  cachedDb = client.db(DB_NAME);

  return cachedDb;
}

export async function getPlayers() {
  const db = await getDb();
  return db.collection<PlayerDoc>('players');
}

export async function getPresence() {
  const db = await getDb();
  return db.collection<PresenceDoc>('presence');
}

export interface PlayerDoc {
  _id?: string;
  playerId: string;
  username: string;
  level: number;
  xp: number;
  questsCompleted: number;
  totalDistance: number;
  lastLocation: { lat: number; lng: number } | null;
  lastActive: Date;
  achievements: string[];
  createdAt: Date;
}

export interface PresenceDoc {
  _id?: string;
  playerId: string;
  username: string;
  lastLocation: { lat: number; lng: number };
  lastSeen: Date;
}
