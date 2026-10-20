import express from 'express';
import helmet from 'helmet';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import { isIP } from 'node:net';
import path from 'node:path';
import { adminEmails, athensToday, InputError, properties, textField } from './config.js';
import { createReservation, updateReservation } from './reservations.js';
import { localizeAuthCookie } from './auth-cookies.js';

const authCookieToUpstream = cookie => (cookie || '').replace(/elements-secure-/g, '__Secure-').replace(/elements-host-/g, '__Host-');
export function createApp(pool, {serveStatic=true, netlify=false, staticRoot=process.cwd()} = {}) {
  const app = express();
  app.disable('x-powered-by');
  const limitOptions = netlify ? {keyGenerator:req=>{
    const address=req.get('x-nf-client-connection-ip');
    return ipKeyGenerator(address && isIP(address) ? address : req.ip);
  }} : {};
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false, strictTransportSecurity: process.env.NODE_ENV === 'production' ? undefined : false }));
  app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.use(express.json({ limit: '12kb' }));
  app.use('/api', (req, _res, next) => {
    const expected = process.env.APP_ORIGIN || `${req.protocol}://${req.get('host')}`;
    if (!['GET','HEAD'].includes(req.method) && req.get('origin') && req.get('origin') !== expected) return next(new InputError('Μη επιτρεπτή προέλευση αιτήματος.', 403));
    if (['POST','PATCH','PUT'].includes(req.method) && (!req.body || Array.isArray(req.body) || typeof req.body !== 'object')) return next(new InputError('Μη έγκυρη φόρμα.'));
    next();
  });
  const requireDb = (_req, _res, next) => {
    if (!process.env.DATABASE_URL) return next(new InputError('Η διαθεσιμότητα δεν είναι διαθέσιμη αυτή τη στιγμή. Επικοινώνησε τηλεφωνικά.', 503));
    next();
  };
  const authUrl = () => process.env.NEON_AUTH_BASE_URL?.replace(/\/$/, '');
  const getAdminEmail = async req => {
    if (!authUrl() || !adminEmails().length) throw new InputError('Δεν έχει οριστεί διαχειριστής.', 503);
    if (!req.get('cookie')) throw new InputError('Συνδέσου για να συνεχίσεις.', 401);
    const response = await fetch(`${authUrl()}/get-session`, { headers: { Cookie: authCookieToUpstream(req.get('cookie')) }, signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new InputError('Η σύνδεσή σου έληξε. Συνδέσου ξανά.', 401);
    const session = await response.json();
    if (!session?.user || !session.session || session.user.banned || !adminEmails().includes(session.user.email.toLowerCase())) throw new InputError('Δεν έχεις πρόσβαση διαχειριστή.', 403);
    return session.user.email.toLowerCase();
  };
  app.get('/api/config', (_req, res) => res.json({ authReady: Boolean(authUrl() && adminEmails().length), bookingReady: Boolean(process.env.DATABASE_URL && authUrl() && adminEmails().length), properties }));
  // Same-origin proxy keeps managed session cookies usable on mobile Safari too.
  // Only the login/session methods used by this admin are exposed here.
  const authPaths = new Map([['get-session', 'GET'], ['sign-in/email', 'POST'], ['sign-out', 'POST']]);
  app.use('/api/auth', rateLimit({ ...limitOptions, windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false }), async (req, res) => {
    const route = req.path.replace(/^\//, '');
    if (!authUrl() || !adminEmails().length) throw new InputError('Η πρόσβαση διαχειριστή δεν έχει ρυθμιστεί ακόμη.', 503);
    if (authPaths.get(route) !== req.method) throw new InputError('Η ενέργεια δεν υποστηρίζεται.', 404);
    if (req.body?.email && !adminEmails().includes(String(req.body.email).trim().toLowerCase())) throw new InputError('Αυτό το email δεν έχει πρόσβαση διαχειριστή.', 403);
    const origin = process.env.APP_ORIGIN || `${req.protocol}://${req.get('host')}`;
    const upstream = await fetch(`${authUrl()}/${route}${req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''}`, {
      method: req.method,
      headers: { 'Content-Type': 'application/json', Origin: origin, Cookie: authCookieToUpstream(req.get('cookie')) },
      body: req.method === 'GET' ? undefined : JSON.stringify(req.body || {}),
      signal: AbortSignal.timeout(15000), redirect: 'manual'
    });
    const cookies = upstream.headers.getSetCookie().map(cookie => localizeAuthCookie(cookie, origin));
    if (cookies.length) res.set('Set-Cookie', cookies);
    res.status(upstream.status).type('json').send(await upstream.text());
  });
  const requireAdmin = async (req, _res, next) => {
    req.adminEmail = await getAdminEmail(req); next();
  };
  app.get('/api/availability', requireDb, async (req, res) => {
    const property = req.query.property;
    if (typeof property !== 'string' || !Object.hasOwn(properties, property)) throw new InputError('Επίλεξε κατάλυμα.');
    const { rows } = await pool.query(`SELECT to_char(stay_date,'YYYY-MM-DD') AS date FROM occupied_nights WHERE property=$1 AND stay_date >= $2::date ORDER BY stay_date`, [property, athensToday()]);
    res.json({ property, dates: rows.map(row => row.date) });
  });
  app.post('/api/bookings', rateLimit({ ...limitOptions, windowMs: 60 * 60 * 1000, limit: 6, standardHeaders: true, legacyHeaders: false }), requireDb, async (req, res) => {
    if (!authUrl() || !adminEmails().length) throw new InputError('Οι online κρατήσεις θα ενεργοποιηθούν σύντομα. Για κράτηση, κάλεσε το τηλέφωνο του καταλύματος.', 503);
    if (req.body.website) throw new InputError('Το αίτημα δεν μπορεί να σταλεί.');
    const name = textField(req.body.name, 120, true);
    const email = textField(req.body.email, 254, true);
    const note = textField(req.body.message, 2000);
    const guests = Number(req.body.guests);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !Number.isInteger(guests) || guests < 1 || guests > (properties[req.body.property]?.capacity || 0)) throw new InputError('Έλεγξε το email και τον αριθμό επισκεπτών.');
    const booking = await createReservation(pool, { ...req.body, name, email, note, guests, kind: 'request' }, 'website');
    res.status(201).json({ id: booking.id, message: 'Το αίτημά σου καταχωρίστηκε και οι ημερομηνίες δεσμεύτηκαν. Η κράτηση θα επιβεβαιωθεί από τον υπεύθυνο του καταλύματος.' });
  });
  app.use('/api/admin', requireDb, requireAdmin);
  app.get('/api/admin/session', (req, res) => res.json({ email: req.adminEmail }));
  app.get('/api/admin/reservations', async (_req, res) => {
    const { rows } = await pool.query(`SELECT id,property,to_char(checkin,'YYYY-MM-DD') AS checkin,to_char(checkout,'YYYY-MM-DD') AS checkout,kind,status,guest_name,guest_email,guests,note,created_at FROM reservations WHERE checkout >= $1::date ORDER BY checkin,created_at DESC LIMIT 1000`, [athensToday()]);
    res.json({ reservations: rows });
  });
  app.post('/api/admin/reservations', async (req, res) => {
    if (!['phone','block'].includes(req.body.kind)) throw new InputError('Επίλεξε τηλεφωνική κράτηση ή μη διαθεσιμότητα.');
    const name = textField(req.body.name, 120);
    const note = textField(req.body.note, 2000);
    const reservation = await createReservation(pool, { ...req.body, name, note, guests: null, email: '' }, req.adminEmail);
    res.status(201).json(reservation);
  });
  app.patch('/api/admin/reservations/:id', async (req, res) => {
    if (!/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(req.params.id) || !['cancel','confirm'].includes(req.body.action)) throw new InputError('Μη έγκυρη ενέργεια.');
    await updateReservation(pool, req.params.id, req.body.action, req.adminEmail);
    res.json({ ok: true });
  });
  app.use('/api', (_req, _res, next) => next(new InputError('Δεν βρέθηκε.', 404)));
  if (serveStatic) {
  const root = path.resolve(staticRoot);
  app.get(['/admin', '/admin/'], (_req, res) => res.set('Cache-Control','no-store').sendFile(path.join(root, 'admin/index.html')));
  app.get(['/admin/reset-password', '/admin/reset-password.html'], (_req, res) => res.redirect(302, '/admin'));
  app.use('/admin', express.static(path.join(root, 'admin'), { index: false, dotfiles: 'deny' }));
  app.use('/public', express.static(path.join(root, 'public'), { dotfiles: 'deny' }));
  app.use('/assets', express.static(path.join(root, 'assets'), { dotfiles: 'deny', maxAge: '1d' }));
  for (const file of ['index.html','styles.css','app.js','ui-controls.js','booking.js']) {
    app.get(file === 'index.html' ? ['/', '/index.html'] : `/${file}`, (_req, res) => res.sendFile(path.join(root, file)));
  }
  }
  app.use((_req, res) => res.status(404).send('Δεν βρέθηκε.'));
  app.use((error, _req, res, _next) => {
    const status = error.status || (error.type === 'entity.parse.failed' ? 400 : 503);
    if (status >= 500) console.error('Request failed:', error.code || error.name);
    res.status(status).json({ error: error instanceof InputError ? error.message : 'Η υπηρεσία δεν είναι διαθέσιμη αυτή τη στιγμή. Δοκίμασε ξανά ή επικοινώνησε τηλεφωνικά.' });
  });
  return app;
}
