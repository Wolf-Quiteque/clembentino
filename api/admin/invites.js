import { sql, ensureSchema } from '../../lib/db.js';
import { seatById } from '../../lib/seats.js';
import { baseUrl, formatPhone, isAdmin, newInviteCode, newShareCode, readBody, send } from '../../lib/util.js';
import { inviteUrl, sendReservationSms, shareUrl, ticketUrl } from '../../lib/guests.js';

export default async function handler(req, res) {
  if (!process.env.ADMIN_PASSWORD) return send(res, 500, { error: 'ADMIN_PASSWORD não está configurado no Vercel.' });
  if (!isAdmin(req)) return send(res, 401, { error: 'Palavra-passe inválida.' });
  try {
    await ensureSchema();
    const base = baseUrl(req);

    if (req.method === 'GET') {
      const rows = await sql`
        SELECT i.*, COALESCE(json_agg(json_build_object(
            'id', g.id, 'name', g.name, 'phone', g.phone, 'isPrimary', g.is_primary, 'ticketCode', g.ticket_code,
            'smsStatus', g.sms_status, 'smsError', g.sms_error, 'createdAt', g.created_at,
            'checkedInAt', g.checked_in_at, 'checkedInBy', g.checked_in_by
          ) ORDER BY g.is_primary DESC, g.created_at) FILTER (WHERE g.id IS NOT NULL), '[]') AS guests
        FROM invites i LEFT JOIN guests g ON g.invite_id = i.id
        GROUP BY i.id ORDER BY i.created_at DESC`;
      return send(res, 200, {
        invites: rows.map(i => ({
          id: i.id, seatId: i.seat_id, label: i.label, maxShares: i.max_shares, active: i.active, createdAt: i.created_at,
          url: inviteUrl(base, i.code), shareUrl: shareUrl(base, i.share_code),
          guests: i.guests.map(g => ({ ...g, phone: formatPhone(g.phone), ticketUrl: ticketUrl(base, g.ticketCode) })),
        })),
      });
    }

    const body = readBody(req);

    if (req.method === 'POST' && body.action === 'resend') {
      const [g] = await sql`SELECT * FROM guests WHERE id = ${Number(body.guestId)}`;
      if (!g) return send(res, 404, { error: 'Convidado não encontrado.' });
      const [invite] = await sql`SELECT * FROM invites WHERE id = ${g.invite_id}`;
      const result = await sendReservationSms(g, invite, base);
      return send(res, result.ok ? 200 : 502, result.ok ? { ok: true } : { error: 'Falha no envio do SMS: ' + result.error });
    }

    if (req.method === 'POST') {
      const seat = seatById(body.seatId);
      const maxShares = Number(body.maxShares);
      if (!seat) return send(res, 400, { error: 'Escolha um tipo de assento.' });
      if (!Number.isInteger(maxShares) || maxShares < 0 || maxShares > 100) return send(res, 400, { error: 'O limite de partilhas deve estar entre 0 e 100.' });
      const label = String(body.label || '').trim().slice(0, 120) || null;
      const [row] = await sql`INSERT INTO invites (code, share_code, seat_id, max_shares, label)
        VALUES (${newInviteCode()}, ${newShareCode()}, ${seat.id}, ${maxShares}, ${label}) RETURNING *`;
      return send(res, 201, { id: row.id, url: inviteUrl(base, row.code) });
    }

    if (req.method === 'PATCH') {
      await sql`UPDATE invites SET active = ${Boolean(body.active)} WHERE id = ${Number(body.id)}`;
      return send(res, 200, { ok: true });
    }

    if (req.method === 'DELETE') {
      await sql`DELETE FROM invites WHERE id = ${Number(req.query.id)}`;
      return send(res, 200, { ok: true });
    }

    return send(res, 405, { error: 'Método não suportado.' });
  } catch (err) {
    console.error(err);
    return send(res, 500, { error: 'Erro no servidor. Tente novamente.' });
  }
}
