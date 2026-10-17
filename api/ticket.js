import { sql, ensureSchema } from '../lib/db.js';
import { seatById } from '../lib/seats.js';
import { baseUrl, send } from '../lib/util.js';
import { poolFor, shareUrl, ticketUrl } from '../lib/guests.js';
import { renderTicketPdf } from '../lib/ticket-pdf.js';
import QRCode from 'qrcode';

export default async function handler(req, res) {
  try {
    await ensureSchema();
    const code = String(req.query.t || '').trim().toUpperCase();
    const [g] = code ? await sql`
      SELECT g.*, i.seat_id, i.max_shares, i.share_code, i.label, i.active
      FROM guests g JOIN invites i ON i.id = g.invite_id WHERE g.ticket_code = ${code}` : [];
    if (!g) return send(res, 404, { error: 'Bilhete não encontrado.' });

    const base = baseUrl(req);
    const seat = seatById(g.seat_id) || { id: g.seat_id, name: g.seat_id, color: 'pw', img: '' };
    const pool = await poolFor(g.invite_id);
    const primary = pool.find(p => p.isPrimary);
    const invitedBy = g.is_primary ? null : primary?.name || null;

    if (req.query.format === 'qr') {
      const svg = await QRCode.toString(ticketUrl(base, g.ticket_code), { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#0d1d35', light: '#0000' } });
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.status(200).send(svg);
    }

    if (req.query.format === 'pdf') {
      const bytes = await renderTicketPdf({ name: g.name, ticketCode: g.ticket_code, seat, ticketUrl: ticketUrl(base, g.ticket_code), invitedBy });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `${req.query.inline ? 'inline' : 'attachment'}; filename="Bilhete-${g.ticket_code}.pdf"`);
      res.setHeader('Cache-Control', 'private, max-age=300');
      return res.status(200).send(Buffer.from(bytes));
    }

    const sharesUsed = pool.filter(p => !p.isPrimary).length;
    return send(res, 200, {
      ticket: { name: g.name, code: g.ticket_code, isPrimary: g.is_primary, seat, active: g.active, invitedBy, url: ticketUrl(base, g.ticket_code) },
      pool,
      share: g.is_primary && g.max_shares > 0
        ? { url: shareUrl(base, g.share_code), max: g.max_shares, left: Math.max(0, g.max_shares - sharesUsed) }
        : null,
    });
  } catch (err) {
    console.error(err);
    return send(res, 500, { error: 'Erro no servidor. Tente novamente.' });
  }
}
