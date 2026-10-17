import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
export const sql = url ? neon(url) : null;

let ready;
// Creates the tables on first use, so no manual migration step is needed.
export function ensureSchema() {
  if (!sql) throw new Error('DATABASE_URL não está configurado.');
  ready ??= sql.transaction([
    sql`CREATE TABLE IF NOT EXISTS invites (
      id SERIAL PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      share_code TEXT UNIQUE NOT NULL,
      seat_id TEXT NOT NULL,
      max_shares INT NOT NULL DEFAULT 0 CHECK (max_shares >= 0),
      label TEXT,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    sql`CREATE TABLE IF NOT EXISTS guests (
      id SERIAL PRIMARY KEY,
      invite_id INT NOT NULL REFERENCES invites(id) ON DELETE CASCADE,
      is_primary BOOLEAN NOT NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      ticket_code TEXT UNIQUE NOT NULL,
      sms_status TEXT,
      sms_error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (invite_id, phone)
    )`,
    sql`CREATE UNIQUE INDEX IF NOT EXISTS guests_one_primary ON guests (invite_id) WHERE is_primary`,
  ]).catch(err => { ready = undefined; throw err; });
  return ready;
}
