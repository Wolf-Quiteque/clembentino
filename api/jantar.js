import { sql, ensureSchema } from '../lib/db.js';
import { cleanName, normalizePhone, readBody, send } from '../lib/util.js';
import { sendDinnerSms } from '../lib/dinner.js';
import { DINNER } from '../lib/event.js';

const FULL = 'As reservas para o jantar estão esgotadas.';

async function seatsLeft() {
  const [r] = await sql`SELECT COUNT(*)::int AS n FROM dinner_reservations`;
  return Math.max(0, DINNER.capacity - r.n);
}

export default async function handler(req, res) {
  try {
    await ensureSchema();
    if (req.method === 'GET') {
      const left = await seatsLeft();
      return send(res, 200, { left, full: left === 0 });
    }
    if (req.method !== 'POST') return send(res, 405, { error: 'Método não suportado.' });
    const body = readBody(req);
    if (body.website) return send(res, 201, { ok: true }); // honeypot field filled in by bots

    const name = cleanName(body.name);
    const phone = normalizePhone(body.phone);
    if (!name) return send(res, 400, { error: 'Indique o seu nome completo.' });
    if (!phone) return send(res, 400, { error: 'Indique um número angolano válido (ex.: 923 456 789).' });

    // One reservation per phone number; repeating it does not send another SMS.
    const [existing] = await sql`SELECT id FROM dinner_reservations WHERE phone = ${phone}`;
    if (existing) return send(res, 200, { ok: true, existing: true });

    // Capped insert: the advisory lock serialises sign-ups so the limit can't be exceeded.
    const [, inserted] = await sql.transaction([
      sql`SELECT pg_advisory_xact_lock(424242)`,
      sql`INSERT INTO dinner_reservations (name, phone)
        SELECT ${name}, ${phone} WHERE (SELECT COUNT(*) FROM dinner_reservations) < ${DINNER.capacity}
        ON CONFLICT (phone) DO NOTHING RETURNING *`,
    ]);
    const [row] = inserted;
    if (!row) {
      const [again] = await sql`SELECT id FROM dinner_reservations WHERE phone = ${phone}`;
      return again ? send(res, 200, { ok: true, existing: true }) : send(res, 409, { error: FULL, full: true });
    }

    await sendDinnerSms(row);
    return send(res, 201, { ok: true, existing: false });
  } catch (err) {
    console.error(err);
    return send(res, 500, { error: 'Erro no servidor. Tente novamente.' });
  }
}
