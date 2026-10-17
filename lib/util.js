import { randomBytes, timingSafeEqual } from 'node:crypto';

const ALNUM = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const TICKET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomString(alphabet, length) {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

export const newInviteCode = () => randomString(ALNUM, 10);
export const newShareCode = () => randomString(ALNUM, 12);
export const newTicketCode = () => {
  const c = randomString(TICKET, 8);
  return `AE-${c.slice(0, 4)}-${c.slice(4)}`;
};

// Angolan mobile numbers: 9 digits starting with 9, optionally prefixed by +244 / 00244.
export function normalizePhone(input) {
  let d = String(input || '').replace(/\D/g, '');
  if (d.startsWith('00244')) d = d.slice(5);
  else if (d.startsWith('244') && d.length === 12) d = d.slice(3);
  return /^9\d{8}$/.test(d) ? d : null;
}

export const formatPhone = p => `+244 ${p.slice(0, 3)} ${p.slice(3, 6)} ${p.slice(6)}`;
export const maskPhone = p => `+244 ${p.slice(0, 2)}• ••• ${p.slice(6)}`;

export function cleanName(input) {
  const n = String(input || '').replace(/\s+/g, ' ').trim();
  return n.length >= 2 && n.length <= 80 ? n : null;
}

export function baseUrl(req) {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return `${proto}://${req.headers['x-forwarded-host'] || req.headers.host}`;
}

export function isAdmin(req) {
  const expected = process.env.ADMIN_PASSWORD;
  const given = req.headers['x-admin-key'];
  if (!expected || typeof given !== 'string') return false;
  const a = Buffer.from(given), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function send(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(body);
}

export function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch { return {}; }
}
