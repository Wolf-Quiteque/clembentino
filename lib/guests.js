import { sql } from './db.js';
import { seatById } from './seats.js';
import { maskPhone, newTicketCode } from './util.js';
import { buildReservationSms, sendSms } from './sms.js';

export const ticketUrl = (base, code) => `${base}/convite?t=${encodeURIComponent(code)}`;
export const inviteUrl = (base, code) => `${base}/convite?c=${encodeURIComponent(code)}`;
export const shareUrl = (base, code) => `${base}/convite?s=${encodeURIComponent(code)}`;

export async function poolFor(inviteId) {
  const rows = await sql`SELECT name, phone, is_primary FROM guests WHERE invite_id = ${inviteId} ORDER BY is_primary DESC, created_at`;
  return rows.map(r => ({ name: r.name, phone: maskPhone(r.phone), isPrimary: r.is_primary }));
}

export async function sendReservationSms(guest, invite, base) {
  const seat = seatById(invite.seat_id);
  const message = buildReservationSms({ name: guest.name, seatName: seat?.name || invite.seat_id, ticketUrl: ticketUrl(base, guest.ticket_code) });
  const result = await sendSms(guest.phone, message);
  await sql`UPDATE guests SET sms_status = ${result.ok ? 'sent' : 'failed'}, sms_error = ${result.error || null} WHERE id = ${guest.id}`;
  return result;
}

// Adds a guest to an invite. Returns { guest, existing } or { error, status }.
export async function addGuest(invite, kind, name, phone) {
  const [existing] = await sql`SELECT * FROM guests WHERE invite_id = ${invite.id} AND phone = ${phone}`;
  if (existing) return { guest: existing, existing: true };

  for (let attempt = 0; attempt < 3; attempt++) {
    const code = newTicketCode();
    let row;
    if (kind === 'primary') {
      // The partial unique index guarantees a single primary guest per invite.
      [row] = await sql`INSERT INTO guests (invite_id, is_primary, name, phone, ticket_code)
        VALUES (${invite.id}, TRUE, ${name}, ${phone}, ${code}) ON CONFLICT DO NOTHING RETURNING *`;
    } else {
      // Serialise joins per invite so the share limit can't be exceeded by concurrent sign-ups.
      const [, inserted] = await sql.transaction([
        sql`SELECT pg_advisory_xact_lock(${invite.id})`,
        sql`INSERT INTO guests (invite_id, is_primary, name, phone, ticket_code)
          SELECT ${invite.id}, FALSE, ${name}, ${phone}, ${code}
          WHERE (SELECT COUNT(*) FROM guests WHERE invite_id = ${invite.id} AND NOT is_primary) < ${invite.max_shares}
          ON CONFLICT DO NOTHING RETURNING *`,
      ]);
      [row] = inserted;
    }
    if (row) return { guest: row, existing: false };

    // Nothing inserted: work out why.
    const [again] = await sql`SELECT * FROM guests WHERE invite_id = ${invite.id} AND phone = ${phone}`;
    if (again) return { guest: again, existing: true };
    const [codeTaken] = await sql`SELECT 1 FROM guests WHERE ticket_code = ${code}`;
    if (codeTaken) continue; // extremely rare ticket-code collision: retry with a new code
    if (kind === 'primary') return { status: 409, error: 'Este convite já foi utilizado. Peça à pessoa que o recebeu o link de partilha.' };
    return { status: 409, error: 'Todos os lugares deste convite já foram preenchidos.' };
  }
  return { status: 500, error: 'Não foi possível gerar o bilhete. Tente novamente.' };
}
