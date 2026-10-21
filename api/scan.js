import { sql, ensureSchema } from '../lib/db.js';
import { seatById } from '../lib/seats.js';
import { formatPhone, readBody, send } from '../lib/util.js';
import { cleanUsername, createToken, scannerFromRequest, verifyPassword } from '../lib/auth.js';

// Pulls the ticket code out of whatever was scanned (full ticket URL or the bare code).
function extractCode(raw) {
  const m = String(raw || '').toUpperCase().match(/AE-[A-Z0-9]{4}-[A-Z0-9]{4}/);
  return m ? m[0] : null;
}

async function stats() {
  const [r] = await sql`SELECT COUNT(*)::int AS total, COUNT(checked_in_at)::int AS inside FROM guests`;
  return r;
}

function guestView(g) {
  const seat = seatById(g.seat_id) || { name: g.seat_id, color: 'pw', img: '' };
  return {
    name: g.name, code: g.ticket_code, phone: formatPhone(g.phone), seat,
    isPrimary: g.is_primary, invitedBy: g.is_primary ? null : g.primary_name || null, label: g.label || null,
    checkedInAt: g.checked_in_at, checkedInBy: g.checked_in_by,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método não suportado.' });
  try {
    await ensureSchema();
    const body = readBody(req);

    if (body.action === 'login') {
      const username = cleanUsername(body.username);
      const [user] = username ? await sql`SELECT * FROM scanner_users WHERE username = ${username} AND active` : [];
      if (!user || !verifyPassword(String(body.password || ''), user.password_hash))
        return send(res, 401, { error: 'Utilizador ou palavra-passe incorrectos.' });
      return send(res, 200, { token: createToken(user.id), name: user.name, stats: await stats() });
    }

    const scanner = await scannerFromRequest(req);
    if (!scanner) return send(res, 401, { error: 'Sessão expirada. Entre novamente.' });

    if (body.action === 'stats') return send(res, 200, { name: scanner.name, stats: await stats() });

    const code = extractCode(body.code);
    if (!code) return send(res, 200, { result: 'invalid', message: 'Este código não é um bilhete do evento.', stats: await stats() });

    // Atomically mark the ticket as used — only the first scan succeeds.
    const [entered] = await sql`
      UPDATE guests g SET checked_in_at = NOW(), checked_in_by = ${scanner.name}
      FROM invites i
      WHERE g.invite_id = i.id AND g.ticket_code = ${code} AND g.checked_in_at IS NULL AND i.active
      RETURNING g.*, i.seat_id, i.label,
        (SELECT p.name FROM guests p WHERE p.invite_id = g.invite_id AND p.is_primary) AS primary_name`;
    if (entered) return send(res, 200, { result: 'ok', guest: guestView(entered), stats: await stats() });

    const [g] = await sql`
      SELECT g.*, i.seat_id, i.label, i.active,
        (SELECT p.name FROM guests p WHERE p.invite_id = g.invite_id AND p.is_primary) AS primary_name
      FROM guests g JOIN invites i ON i.id = g.invite_id WHERE g.ticket_code = ${code}`;
    if (!g) return send(res, 200, { result: 'invalid', message: `O bilhete ${code} não existe na lista.`, stats: await stats() });
    if (!g.active) return send(res, 200, { result: 'blocked', message: 'Este convite foi desactivado pela organização.', guest: guestView(g), stats: await stats() });
    return send(res, 200, { result: 'used', message: 'Este bilhete já foi utilizado.', guest: guestView(g), stats: await stats() });
  } catch (err) {
    console.error(err);
    return send(res, 500, { error: 'Erro no servidor. Tente novamente.' });
  }
}
