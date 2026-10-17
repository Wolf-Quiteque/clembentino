import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import QRCode from 'qrcode';
import { EVENT } from './event.js';
import { SEAT_COLORS } from './seats.js';

const ROOT = process.cwd();
const asset = p => readFile(path.join(ROOT, 'lib', p));

const hex = h => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
const C = {
  navy: hex('#0d1d35'),
  ink: hex('#172032'),
  muted: hex('#68717a'),
  pink: hex('#ed0b8c'),
  deep: hex('#8c155e'),
  blush: hex('#fff3f9'),
  line: hex('#f2c6df'),
  white: rgb(1, 1, 1),
  black: hex('#191919'),
};
const mix = (a, b, t) => rgb(a.red + (b.red - a.red) * t, a.green + (b.green - a.green) * t, a.blue + (b.blue - a.blue) * t);

const W = 420, H = 860, M = 22, R = 22;          // page, card margin, card radius
const CW = W - M * 2;                              // card width
const HEADER = 330;                                // pink header height (from card top)
const PERF = 612;                                  // perforation line (from card top)
const CARD_H = H - M * 2 - 26;                     // leave room for footer line

export async function renderTicketPdf({ name, ticketCode, seat, ticketUrl, invitedBy }) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(`Bilhete ${ticketCode} — ${EVENT.name}`);
  pdf.setAuthor('Clembetino');

  const [xb, b, md, pf, dm, logoBytes, seatBytes] = await Promise.all([
    asset('fonts/Montserrat-ExtraBold.ttf'), asset('fonts/Montserrat-Bold.ttf'), asset('fonts/Montserrat-Medium.ttf'),
    asset('fonts/PlayfairDisplay-MediumItalic.ttf'), asset('fonts/DMSans-Regular.ttf'),
    asset('ticket-img/logo.png'),
    asset('ticket-img/' + path.basename(seat.img)).catch(() => null),
  ]);
  const F = {
    xb: await pdf.embedFont(xb, { subset: true }),
    b: await pdf.embedFont(b, { subset: true }),
    md: await pdf.embedFont(md, { subset: true }),
    pf: await pdf.embedFont(pf, { subset: true }),
    dm: await pdf.embedFont(dm, { subset: true }),
  };
  const logo = await pdf.embedPng(logoBytes);
  const seatImg = seatBytes ? await pdf.embedJpg(seatBytes) : null;

  const page = pdf.addPage([W, H]);
  // Top-down helpers: (x, top) are measured from the top-left of the page.
  const Y = top => H - top;
  const text = (s, x, top, font, size, color, opts = {}) =>
    page.drawText(s, { x, y: Y(top) - size * 0.78, font, size, color, ...opts });
  const width = (s, font, size, spacing = 0) => font.widthOfTextAtSize(s, size) + spacing * (s.length - 1);
  const spaced = (s, x, top, font, size, color, spacing, opacity = 1) => {
    let cx = x;
    for (const ch of s) { text(ch, cx, top, font, size, color, { opacity }); cx += font.widthOfTextAtSize(ch, size) + spacing; }
  };
  const svg = (d, opts) => page.drawSvgPath(d, { x: 0, y: H, ...opts });
  const roundRect = (x, top, w, h, r) =>
    `M${x + r},${top} H${x + w - r} A${r},${r} 0 0 1 ${x + w},${top + r} V${top + h - r} A${r},${r} 0 0 1 ${x + w - r},${top + h} H${x + r} A${r},${r} 0 0 1 ${x},${top + h - r} V${top + r} A${r},${r} 0 0 1 ${x + r},${top} Z`;
  const wrap = (s, font, size, maxW) => {
    const lines = []; let line = '';
    for (const word of s.split(' ')) {
      const t = line ? line + ' ' + word : word;
      if (line && width(t, font, size) > maxW) { lines.push(line); line = word; } else line = t;
    }
    if (line) lines.push(line);
    return lines;
  };

  // Page background — deep navy, like a night at the venue.
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: C.navy });
  page.drawCircle({ x: W - 30, y: Y(40), size: 160, color: C.pink, opacity: 0.16 });
  page.drawCircle({ x: 10, y: Y(H - 60), size: 140, color: C.pink, opacity: 0.1 });

  // Card body (white) + pink gradient header.
  svg(roundRect(M, M, CW, CARD_H, R), { color: C.white });
  const steps = 90;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const h = HEADER / steps + (i === 0 ? 0 : 0.6); // small overlap hides seams between bands
    page.drawRectangle({ x: M, y: Y(M + (HEADER * (i + 1)) / steps), width: CW, height: h, color: mix(C.pink, C.deep, t) });
  }
  // Re-round the header's top corners by masking them with the page colour.
  const cm = (cx, cy, sx) => `M${cx},${cy} H${cx + sx * R} A${R},${R} 0 0 ${sx > 0 ? 0 : 1} ${cx},${cy + R} Z`;
  svg(cm(M, M, 1), { color: C.navy });
  svg(cm(M + CW, M, -1), { color: C.navy });

  // Header decoration: soft rings and dots.
  page.drawCircle({ x: M + CW - 40, y: Y(M + 70), size: 120, borderColor: C.white, borderWidth: 1, borderOpacity: 0.18 });
  page.drawCircle({ x: M + CW - 40, y: Y(M + 70), size: 78, color: C.white, opacity: 0.07 });
  page.drawCircle({ x: M + 20, y: Y(M + HEADER - 10), size: 90, color: C.white, opacity: 0.05 });
  for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++)
    page.drawCircle({ x: M + CW - 120 + i * 12, y: Y(M + 244 + j * 12), size: 1.4, color: C.white, opacity: 0.35 });

  // Logo on a white pill.
  const lx = M + 20, lt = M + 20, lw = 104, lh = (logo.height / logo.width) * lw;
  svg(roundRect(lx, lt, lw + 20, lh + 12, (lh + 12) / 2), { color: C.white });
  page.drawImage(logo, { x: lx + 10, y: Y(lt + 6 + lh), width: lw, height: lh });

  // "Convite" tag.
  const tag = 'CONVITE  ·  ENTRADA GRATUITA';
  const tagW = width(tag, F.b, 7.5, 1) + 22;
  svg(roundRect(M + CW - 20 - tagW, lt + 6, tagW, 22, 11), { borderColor: C.white, borderWidth: 1, borderOpacity: 0.6 });
  spaced(tag, M + CW - 20 - tagW + 11, lt + 13, F.b, 7.5, C.white, 1);

  // Title block.
  const tx = M + 26;
  spaced(EVENT.edition.toUpperCase(), tx, M + 104, F.b, 9, C.white, 2.2, 0.8);
  text('APRENDA &', tx, M + 124, F.xb, 42, C.white);
  text('Empreenda com Elas.', tx, M + 170, F.pf, 36, C.white);
  text(EVENT.kicker, tx, M + 216, F.md, 11.5, C.white, { opacity: 0.88 });

  // Date badge.
  const bx = tx, bt = M + 252;
  svg(roundRect(bx, bt, 58, 58, 14), { color: C.white });
  const day = '23';
  text(day, bx + (58 - width(day, F.xb, 24)) / 2, bt + 9, F.xb, 24, C.pink);
  spaced('OUT', bx + (58 - width('OUT', F.b, 9, 1.5)) / 2, bt + 38, F.b, 9, C.navy, 1.5);
  text('Sexta-feira · ' + EVENT.time, bx + 72, bt + 12, F.b, 13, C.white);
  text(`${EVENT.venue} · ${EVENT.area}`, bx + 72, bt + 32, F.dm, 10.5, C.white, { opacity: 0.9 });

  // --- Body ---
  const bodyX = M + 26, bodyW = CW - 52;
  spaced('CONVIDADO(A)', bodyX, M + HEADER + 26, F.b, 8, C.pink, 1.8);
  const nameSize = width(name, F.xb, 24) > bodyW ? Math.max(15, (24 * bodyW) / width(name, F.xb, 24)) : 24;
  text(name, bodyX, M + HEADER + 42, F.xb, nameSize, C.navy);

  // Info row.
  const infoTop = M + HEADER + 84;
  page.drawLine({ start: { x: bodyX, y: Y(infoTop - 8) }, end: { x: bodyX + bodyW, y: Y(infoTop - 8) }, thickness: 0.8, color: C.line });
  const cols = [['DATA', EVENT.dateShort], ['HORA', EVENT.time], ['LOCAL', 'Cidade Alta']];
  const colW = bodyW / 3;
  cols.forEach(([k, v], i) => {
    spaced(k, bodyX + i * colW, infoTop + 4, F.b, 7.5, C.muted, 1.6);
    text(v, bodyX + i * colW, infoTop + 18, F.b, 13, C.ink);
  });

  // Seat block.
  const st = infoTop + 54, imgW = 132, imgH = 92;
  svg(roundRect(bodyX, st, bodyW, imgH + 20, 14), { color: C.blush });
  if (seatImg) page.drawImage(seatImg, { x: bodyX + 10, y: Y(st + 10 + imgH), width: imgW, height: imgH });
  // Rounded frame over the photo corners.
  const fx = bodyX + 10, ft = st + 10, fr = 9;
  svg(`M${fx},${ft} H${fx + fr} A${fr},${fr} 0 0 0 ${fx},${ft + fr} Z`, { color: C.blush });
  svg(`M${fx + imgW},${ft} V${ft + fr} A${fr},${fr} 0 0 0 ${fx + imgW - fr},${ft} Z`, { color: C.blush });
  svg(`M${fx},${ft + imgH} V${ft + imgH - fr} A${fr},${fr} 0 0 0 ${fx + fr},${ft + imgH} Z`, { color: C.blush });
  svg(`M${fx + imgW},${ft + imgH} H${fx + imgW - fr} A${fr},${fr} 0 0 0 ${fx + imgW},${ft + imgH - fr} Z`, { color: C.blush });

  const sx = bodyX + imgW + 24, sw = bodyW - imgW - 34;
  spaced('O SEU SECTOR', sx, st + 16, F.b, 7.5, C.pink, 1.6);
  const seatLines = wrap(seat.name, F.xb, 14, sw).slice(0, 3);
  seatLines.forEach((l, i) => text(l, sx, st + 32 + i * 17, F.xb, 14, C.navy));
  const swTop = st + 36 + seatLines.length * 17 + 4;
  page.drawCircle({ x: sx + 6, y: Y(swTop + 6), size: 6, color: C.pink });
  page.drawCircle({ x: sx + 19, y: Y(swTop + 6), size: 6, color: seat.color === 'pb' ? C.black : C.white, borderColor: C.muted, borderWidth: 0.5 });
  text(SEAT_COLORS[seat.color] || '', sx + 32, swTop + 1, F.md, 9.5, C.muted);

  // --- Perforation with side notches ---
  const py = M + PERF;
  page.drawCircle({ x: M, y: Y(py), size: 14, color: C.navy });
  page.drawCircle({ x: M + CW, y: Y(py), size: 14, color: C.navy });
  page.drawLine({ start: { x: M + 22, y: Y(py) }, end: { x: M + CW - 22, y: Y(py) }, thickness: 1.2, color: C.line, dashArray: [5, 5] });

  // --- Stub: QR + code ---
  const qr = QRCode.create(ticketUrl, { errorCorrectionLevel: 'M' });
  const n = qr.modules.size, qrSize = 132, cell = qrSize / n;
  const qx = bodyX, qt = py + 26;
  svg(roundRect(qx - 8, qt - 8, qrSize + 16, qrSize + 16, 12), { borderColor: C.line, borderWidth: 1 });
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++)
    if (qr.modules.get(r, c)) page.drawRectangle({ x: qx + c * cell, y: Y(qt + (r + 1) * cell), width: cell + 0.05, height: cell + 0.05, color: C.navy });

  const cx = qx + qrSize + 28;
  spaced('CÓDIGO DO BILHETE', cx, qt + 6, F.b, 7.5, C.pink, 1.6);
  text(ticketCode, cx, qt + 22, F.xb, 19, C.navy);
  const note = wrap('Apresente este QR code à entrada. Bilhete pessoal e intransmissível.', F.dm, 9.5, CW - (cx - M) - 22);
  note.forEach((l, i) => text(l, cx, qt + 54 + i * 13, F.dm, 9.5, C.muted));
  if (invitedBy) {
    const by = wrap(`Convite partilhado por ${invitedBy}`, F.md, 9, CW - (cx - M) - 22);
    by.forEach((l, i) => text(l, cx, qt + 60 + note.length * 13 + i * 12, F.md, 9, C.deep));
  }

  // Footer line on the navy background.
  const foot = 'CLEMBETINO  ·  SOLUÇÕES INTEGRADAS  ·  LUANDA';
  spaced(foot, (W - width(foot, F.b, 7.5, 1.6)) / 2, H - M - 12, F.b, 7.5, C.white, 1.6, 0.55);

  return pdf.save();
}
