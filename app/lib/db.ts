import postgres from 'postgres';

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
