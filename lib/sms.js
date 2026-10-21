import { DINNER, EVENT } from './event.js';

const OMBALA_URL = 'https://api.useombala.ao/v1/messages';

export function buildReservationSms({ name, seatName, ticketUrl }) {
  const first = name.split(' ')[0];
  return [
    `Olá ${first}! O seu lugar está reservado na conferência ${EVENT.name}.`,
    ``,
    `Data: ${EVENT.dateLong}, às ${EVENT.time}`,
    `Local: ${EVENT.venue}, ${EVENT.area}`,
    `Lugar: ${seatName}`,
    ``,
    `O seu bilhete com QR code: ${ticketUrl}`,
    ``,
    `Esperamos por si para um dia de inspiração. Clembetino`,
  ].join('\n');
}

export function buildDinnerSms({ name }) {
  const first = name.split(' ')[0];
  return [
    `Olá ${first}! O seu lugar está reservado para o ${DINNER.name} ${EVENT.name}.`,
    ``,
    `Data: ${DINNER.dateLong}, às ${DINNER.time}`,
    `Local: ${DINNER.venue}`,
    `Valor: ${DINNER.price} por pessoa`,
    ``,
    `Para efectuar o pagamento, entre em contacto com ${DINNER.info} no WhatsApp: https://wa.me/244${DINNER.info.replace(/\s/g, '')}`,
    `Esperamos por si para uma noite especial. Clembetino`,
  ].join('\n');
}

// Sends one SMS through Ombala. Never throws: returns { ok, error }.
export async function sendSms(phone, message) {
  const token = process.env.SMSAUTHTOKEN;
  if (!token) return { ok: false, error: 'SMSAUTHTOKEN não configurado' };
  try {
    const res = await fetch(OMBALA_URL, {
      method: 'POST',
      headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, from: process.env.SMS_SENDER || 'CLEMBETINO', to: phone }),
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) return { ok: true };
    const text = await res.text().catch(() => '');
    return { ok: false, error: `HTTP ${res.status} ${text}`.slice(0, 300) };
  } catch (err) {
    return { ok: false, error: String(err?.message || err).slice(0, 300) };
  }
}
