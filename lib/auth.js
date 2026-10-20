import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { sql } from './db.js';

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 32).toString('hex')}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const a = scryptSync(password, salt, 32), b = Buffer.from(hash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

// Stateless scanner session: base64url(payload).hmac — signed with a server secret.
const secret = () => process.env.SCANNER_SECRET || process.env.ADMIN_PASSWORD || '';
const sign = data => createHmac('sha256', secret()).update(data).digest('base64url');
const SESSION_DAYS = 7;

export function createToken(userId) {
  const data = Buffer.from(JSON.stringify({ u: userId, exp: Date.now() + SESSION_DAYS * 864e5 })).toString('base64url');
  return `${data}.${sign(data)}`;
}

// Returns the active scanner user for the request, or null.
export async function scannerFromRequest(req) {
  if (!secret()) return null;
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const [data, mac] = token.split('.');
  if (!data || !mac) return null;
  const expected = Buffer.from(sign(data)), given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  let payload;
  try { payload = JSON.parse(Buffer.from(data, 'base64url').toString()); } catch { return null; }
  if (!payload.exp || payload.exp < Date.now()) return null;
  const [user] = await sql`SELECT id, username, name FROM scanner_users WHERE id = ${payload.u} AND active`;
  return user || null;
}

export const cleanUsername = u => {
  const v = String(u || '').trim().toLowerCase();
  return /^[a-z0-9._-]{3,32}$/.test(v) ? v : null;
};
