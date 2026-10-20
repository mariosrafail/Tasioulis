import dotenv from 'dotenv';
dotenv.config({ path: process.env.ENV_FILE || '.env.local', quiet: true });

export const properties = {
  SkouZen: { capacity: 2, phone: '6970878029' },
  Ivory: { capacity: 2, phone: '6970878029' },
  Pearl: { capacity: 4, phone: '2104520279' }
};
export const adminEmails = () => (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
export const athensToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Athens', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

export class InputError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export function validateStay(body) {
  const { property, checkin, checkout } = body;
  if (!Object.hasOwn(properties, property)) throw new InputError('Επίλεξε έγκυρο κατάλυμα.');
  for (const value of [checkin, checkout]) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) {
      throw new InputError('Συμπλήρωσε έγκυρες ημερομηνίες.');
    }
  }
  const nights = (Date.parse(checkout) - Date.parse(checkin)) / 86400000;
  const latest = new Date(`${athensToday()}T12:00:00Z`); latest.setUTCFullYear(latest.getUTCFullYear() + 2);
  if (checkin < athensToday() || checkout > latest.toISOString().slice(0, 10) || nights < 1 || nights > 365) {
    throw new InputError('Η αναχώρηση πρέπει να είναι μετά την άφιξη. Επίλεξε έως 365 νύχτες μέσα στα επόμενα δύο έτη.');
  }
  return { property, checkin, checkout };
}
export function textField(value, max, required = false) {
  if (value != null && typeof value !== 'string') throw new InputError('Μη έγκυρα στοιχεία.');
  const text = (value || '').trim();
  if ((required && !text) || text.length > max) throw new InputError('Έλεγξε τα στοιχεία της φόρμας.');
  return text;
}
