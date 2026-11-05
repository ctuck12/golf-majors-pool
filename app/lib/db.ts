import postgres from 'postgres';
import { SCHEMA_SQL } from './db-schema';

// Server-only Postgres client for user data (Supabase). DATABASE_URL should be Supabase's
// transaction pooler URL (port 6543), which doesn't support prepared statements, hence
// prepare: false. One small pool per server instance.
let client: ReturnType<typeof postgres> | null = null;

export function db() {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL is not set.');
    }
    client = postgres(url, {
      prepare: false,
      max: 5,
      idle_timeout: 20,
      connect_timeout: 10,
    });
  }
  return client;
}

export type Sql = ReturnType<typeof db>;
export type TxSql = postgres.TransactionSql;

// Brings the user-data tables up to date once per server instance (every statement in SCHEMA_SQL
// is "if not exists"), so a deploy that adds a table or column works without a manual step.
let schemaReady: Promise<void> | null = null;

export function ensureSchema() {
  if (!schemaReady) {
    schemaReady = db()
      .unsafe(SCHEMA_SQL)
      .then(() => undefined)
      .catch((error) => {
        // Another instance may be applying the same change at that moment; try again next call.
        schemaReady = null;
        console.error('Schema check failed', error);
      });
  }
  return schemaReady;
}
