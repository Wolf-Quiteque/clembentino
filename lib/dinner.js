import { sql } from './db.js';
import { buildDinnerSms, sendSms } from './sms.js';

export async function sendDinnerSms(r) {
  const result = await sendSms(r.phone, buildDinnerSms({ name: r.name }));
  await sql`UPDATE dinner_reservations SET sms_status = ${result.ok ? 'sent' : 'failed'}, sms_error = ${result.error || null} WHERE id = ${r.id}`;
  return result;
}
