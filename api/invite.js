import { sql, ensureSchema } from '../lib/db.js';
import { seatById } from '../lib/seats.js';
import { baseUrl, cleanName, normalizePhone, readBody, send } from '../lib/util.js';
import { addGuest, poolFor, sendReservationSms } from '../lib/guests.js';

async function findInvite({ c, s }) {
  if (typeof c === 'string' && c) {
    const [invite] = await sql`SELECT * FROM invites WHERE code = ${c}`;
    return invite ? { invite, kind: 'primary' } : null;
  }
  if (typeof s === 'string' && s) {
    const [invite] = await sql`SELECT * FROM invites WHERE share_code = ${s}`;
    return invite ? { invite, kind: 'share' } : null;
  }
  return null;
}

async function describe(invite, kind) {
  const pool = await poolFor(invite.id);
  const primary = pool.find(p => p.isPrimary);
  const sharesUsed = pool.filter(p => !p.isPrimary).length;
  let closed = null;
  if (!invite.active) closed = 'Este convite foi desactivado pela organização.';
  else if (kind === 'primary' && primary) closed = 'Este convite já foi utilizado. Peça à pessoa que o recebeu o link de partilha.';
  else if (kind === 'share' && !primary) closed = 'Este link de partilha ainda não está activo.';
  else if (kind === 'share' && sharesUsed >= invite.max_shares) closed = 'Todos os lugares deste convite já foram preenchidos.';
  return {
    kind,
    seat: seatById(invite.seat_id),
    label: invite.label,
    maxShares: invite.max_shares,
    sharesLeft: Math.max(0, invite.max_shares - sharesUsed),
    invitedBy: kind === 'share' ? primary?.name || null : null,
    closed,
    pool,
  };
}

export default async function handler(req, res) {
  try {
    await ensureSchema();
    const params = req.method === 'GET' ? req.query : readBody(req);
    const found = await findInvite(params);
    if (!found) return send(res, 404, { error: 'Convite não encontrado. Verifique o link.' });
    const { invite, kind } = found;

    if (req.method === 'GET') return send(res, 200, await describe(invite, kind));
    if (req.method !== 'POST') return send(res, 405, { error: 'Método não suportado.' });

    if (!invite.active) return send(res, 410, { error: 'Este convite foi desactivado pela organização.' });
    const name = cleanName(params.name);
    const phone = normalizePhone(params.phone);
    if (!name) return send(res, 400, { error: 'Indique o seu nome completo.' });
    if (!phone) return send(res, 400, { error: 'Indique um número angolano válido (ex.: 923 456 789).' });

    if (kind === 'share') {
      const [primary] = await sql`SELECT 1 FROM guests WHERE invite_id = ${invite.id} AND is_primary`;
      if (!primary) return send(res, 409, { error: 'Este link de partilha ainda não está activo.' });
    }

    const result = await addGuest(invite, kind, name, phone);
    if (result.error) return send(res, result.status, { error: result.error });
    if (!result.existing) await sendReservationSms(result.guest, invite, baseUrl(req));
    return send(res, result.existing ? 200 : 201, { ticketCode: result.guest.ticket_code, existing: result.existing });
  } catch (err) {
    console.error(err);
    return send(res, 500, { error: 'Erro no servidor. Tente novamente.' });
  }
}
