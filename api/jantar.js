import { sql, ensureSchema } from '../lib/db.js';
import { cleanName, normalizePhone, readBody, send } from '../lib/util.js';
import { sendDinnerSms } from '../lib/dinner.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método não suportado.' });
  try {
    await ensureSchema();
    const body = readBody(req);
    if (body.website) return send(res, 201, { ok: true }); // honeypot field filled in by bots

    const name = cleanName(body.name);
    const phone = normalizePhone(body.phone);
    if (!name) return send(res, 400, { error: 'Indique o seu nome completo.' });
    if (!phone) return send(res, 400, { error: 'Indique um número angolano válido (ex.: 923 456 789).' });

    // One reservation per phone number; repeating it does not send another SMS.
    const [row] = await sql`INSERT INTO dinner_reservations (name, phone) VALUES (${name}, ${phone})
      ON CONFLICT (phone) DO NOTHING RETURNING *`;
    if (!row) return send(res, 200, { ok: true, existing: true });

    await sendDinnerSms(row);
    return send(res, 201, { ok: true, existing: false });
  } catch (err) {
    console.error(err);
    return send(res, 500, { error: 'Erro no servidor. Tente novamente.' });
  }
}
