import { randomUUID } from 'node:crypto';
import { InputError, validateStay } from './config.js';

export async function createReservation(pool, input, actor) {
  const stay = validateStay(input);
  const db = await pool.connect();
  const id = randomUUID();
  try {
    await db.query('BEGIN');
    await db.query(`INSERT INTO reservations
      (id,property,checkin,checkout,kind,status,guest_name,guest_email,guests,note,created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [id, stay.property, stay.checkin, stay.checkout, input.kind, input.kind === 'request' ? 'pending' : 'confirmed', input.name || '', input.email || '', input.guests || null, input.note || '', actor]);
    await db.query(`INSERT INTO occupied_nights(property,stay_date,reservation_id)
      SELECT $1, day::date, $2 FROM generate_series($3::date, $4::date - 1, interval '1 day') AS day`,
    [stay.property, id, stay.checkin, stay.checkout]);
    await db.query('INSERT INTO reservation_audit(reservation_id,action,actor) VALUES ($1,$2,$3)', [id, 'created', actor]);
    await db.query('COMMIT');
    return { id, ...stay };
  } catch (error) {
    await db.query('ROLLBACK');
    if (error.code === '23505') throw new InputError('Οι ημερομηνίες μόλις δεσμεύτηκαν ή δεν είναι διαθέσιμες. Επίλεξε άλλες ημερομηνίες.', 409);
    throw error;
  } finally { db.release(); }
}
export async function updateReservation(pool, id, action, actor) {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const { rows } = await db.query('SELECT status,kind FROM reservations WHERE id=$1 FOR UPDATE', [id]);
    if (!rows.length) throw new InputError('Η καταχώριση δεν βρέθηκε.', 404);
    if (action === 'confirm' && (rows[0].status !== 'pending' || rows[0].kind !== 'request')) throw new InputError('Το αίτημα δεν είναι σε αναμονή.', 409);
    if (action === 'cancel') await db.query('DELETE FROM occupied_nights WHERE reservation_id=$1', [id]);
    await db.query('UPDATE reservations SET status=$2,updated_at=now() WHERE id=$1', [id, action === 'cancel' ? 'cancelled' : 'confirmed']);
    await db.query('INSERT INTO reservation_audit(reservation_id,action,actor) VALUES ($1,$2,$3)', [id, action, actor]);
    await db.query('COMMIT');
  } catch (error) { await db.query('ROLLBACK'); throw error; }
  finally { db.release(); }
}
