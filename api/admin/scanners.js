import { sql, ensureSchema } from '../../lib/db.js';
import { isAdmin, readBody, send } from '../../lib/util.js';
import { cleanUsername, hashPassword } from '../../lib/auth.js';

export default async function handler(req, res) {
  if (!process.env.ADMIN_PASSWORD) return send(res, 500, { error: 'ADMIN_PASSWORD não está configurado no Vercel.' });
  if (!isAdmin(req)) return send(res, 401, { error: 'Palavra-passe inválida.' });
  try {
    await ensureSchema();
    const body = readBody(req);

    if (req.method === 'GET') {
      const users = await sql`
        SELECT u.id, u.username, u.name, u.active, u.created_at AS "createdAt",
          (SELECT COUNT(*)::int FROM guests g WHERE g.checked_in_by = u.name) AS scans
        FROM scanner_users u ORDER BY u.created_at DESC`;
      return send(res, 200, { users });
    }

    if (req.method === 'POST') {
      const username = cleanUsername(body.username);
      const name = String(body.name || '').replace(/\s+/g, ' ').trim().slice(0, 60);
      const password = String(body.password || '');
      if (!name) return send(res, 400, { error: 'Indique o nome da pessoa.' });
      if (!username) return send(res, 400, { error: 'Utilizador: 3 a 32 letras/números, sem espaços (ex.: joana).' });
      if (password.length < 6) return send(res, 400, { error: 'A palavra-passe deve ter pelo menos 6 caracteres.' });
      const [row] = await sql`INSERT INTO scanner_users (username, name, password_hash)
        VALUES (${username}, ${name}, ${hashPassword(password)}) ON CONFLICT (username) DO NOTHING RETURNING id`;
      if (!row) return send(res, 409, { error: 'Já existe um utilizador com esse nome.' });
      return send(res, 201, { id: row.id });
    }

    if (req.method === 'PATCH') {
      const id = Number(body.id);
      if (body.password !== undefined) {
        if (String(body.password).length < 6) return send(res, 400, { error: 'A palavra-passe deve ter pelo menos 6 caracteres.' });
        await sql`UPDATE scanner_users SET password_hash = ${hashPassword(String(body.password))} WHERE id = ${id}`;
      }
      if (body.active !== undefined) await sql`UPDATE scanner_users SET active = ${Boolean(body.active)} WHERE id = ${id}`;
      return send(res, 200, { ok: true });
    }

    if (req.method === 'DELETE') {
      await sql`DELETE FROM scanner_users WHERE id = ${Number(req.query.id)}`;
      return send(res, 200, { ok: true });
    }

    return send(res, 405, { error: 'Método não suportado.' });
  } catch (err) {
    console.error(err);
    return send(res, 500, { error: 'Erro no servidor. Tente novamente.' });
  }
}
