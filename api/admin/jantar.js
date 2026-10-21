import { sql, ensureSchema } from '../../lib/db.js';
import { formatPhone, isAdmin, readBody, send } from '../../lib/util.js';
import { sendDinnerSms } from '../../lib/dinner.js';
import { DINNER } from '../../lib/event.js';

export default async function handler(req, res) {
  if (!process.env.ADMIN_PASSWORD) return send(res, 500, { error: 'ADMIN_PASSWORD não está configurado no Vercel.' });
  if (!isAdmin(req)) return send(res, 401, { error: 'Palavra-passe inválida.' });
  try {
    await ensureSchema();

    if (req.method === 'GET') {
      const rows = await sql`SELECT * FROM dinner_reservations ORDER BY created_at DESC`;
      return send(res, 200, {
        capacity: DINNER.capacity,
        reservations: rows.map(r => ({ id: r.id, name: r.name, phone: formatPhone(r.phone), smsStatus: r.sms_status, smsError: r.sms_error, createdAt: r.created_at, paidAt: r.paid_at })),
      });
    }

    if (req.method === 'POST') {
      const [r] = await sql`SELECT * FROM dinner_reservations WHERE id = ${Number(readBody(req).id)}`;
      if (!r) return send(res, 404, { error: 'Reserva não encontrada.' });
      const result = await sendDinnerSms(r);
      return send(res, result.ok ? 200 : 502, result.ok ? { ok: true } : { error: 'Falha no envio do SMS: ' + result.error });
    }

    if (req.method === 'PATCH') {
      const body = readBody(req);
      if (body.paid) await sql`UPDATE dinner_reservations SET paid_at = NOW() WHERE id = ${Number(body.id)} AND paid_at IS NULL`;
      else await sql`UPDATE dinner_reservations SET paid_at = NULL WHERE id = ${Number(body.id)}`;
      return send(res, 200, { ok: true });
    }

    if (req.method === 'DELETE') {
      await sql`DELETE FROM dinner_reservations WHERE id = ${Number(req.query.id)}`;
      return send(res, 200, { ok: true });
    }

    return send(res, 405, { error: 'Método não suportado.' });
  } catch (err) {
    console.error(err);
    return send(res, 500, { error: 'Erro no servidor. Tente novamente.' });
  }
}
