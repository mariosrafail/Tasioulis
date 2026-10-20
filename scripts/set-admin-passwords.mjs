// Explicit owner maintenance task. Never stores passwords, tokens or hashes in files.
// Password input uses a hidden terminal prompt; only configured admin emails are touched.
import '../server/config.js';
import { adminEmails } from '../server/config.js';
import pg from 'pg';

function hiddenPassword() {
  if (!process.stdin.isTTY) throw new Error('Run in an interactive terminal.');
  process.stdout.write('New password (hidden input): ');
  process.stdin.setRawMode(true); process.stdin.setEncoding('utf8'); process.stdin.resume();
  return new Promise((resolve, reject) => {
    let value = '';
    const finish = () => { process.stdin.off('data', read); process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write('\n'); };
    function read(chunk) {
      for (const character of chunk) {
        if (character === '\u0003') { finish(); reject(new Error('Cancelled.')); return; }
        if (character === '\r' || character === '\n') { finish(); resolve(value); return; }
        if (character === '\u007f' || character === '\b') value = value.slice(0,-1);
        else value += character;
      }
    }
    process.stdin.on('data', read);
  });
}
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED, max:1 });
let password;
try {
  password = await hiddenPassword();
  if (password.length < 12 || password.length > 128) throw new Error('Use 12–128 characters.');
  const origin = process.env.APP_ORIGIN;
  const base = process.env.NEON_AUTH_BASE_URL?.replace(/\/$/,'');
  if (!base || !origin || !process.env.DATABASE_URL_UNPOOLED) throw new Error('Missing server configuration.');
  for (const email of adminEmails()) {
    const { rows: users } = await db.query('SELECT id FROM neon_auth."user" WHERE lower(email)=$1', [email]);
    if (users.length !== 1) throw new Error(`Admin account missing: ${email}`);
    const post = (path, body) => fetch(`${base}/${path}`, { method:'POST', headers:{'Content-Type':'application/json', Origin:origin}, body:JSON.stringify(body), signal:AbortSignal.timeout(15000) });
    // Request the standard managed reset. The owner has explicitly authorized this
    // password change. Resolve its single-use token privately through the owner DB
    // connection, then let Managed Auth hash the password and consume the token.
    if (!process.argv.includes('--verify-only')) {
    const requested = await post('request-password-reset', { email, redirectTo:`${origin}/admin/reset-password` });
    if (!requested.ok) throw new Error(`Reset request failed (${requested.status}) for ${email}`);
    const { rows: resets } = await db.query(`SELECT identifier FROM neon_auth.verification WHERE value=$1 AND identifier LIKE 'reset-password:%' AND "expiresAt">now() ORDER BY "createdAt" DESC LIMIT 1`, [users[0].id]);
    if (!resets.length) throw new Error(`No active reset request for ${email}`);
    const token = resets[0].identifier.slice('reset-password:'.length);
    const updated = await post('reset-password', { token, newPassword:password });
    if (!updated.ok) throw new Error(`Password update failed (${updated.status}) for ${email}`);
    }
    const signedIn = await fetch(`${origin}/api/auth/sign-in/email`, { method:'POST', headers:{'Content-Type':'application/json',Origin:origin}, body:JSON.stringify({email,password}), signal:AbortSignal.timeout(15000) });
    if (!signedIn.ok) throw new Error(`Password sign-in verification failed (${signedIn.status}) for ${email}`);
    const result = await signedIn.json();
    const cookies = signedIn.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');
    const session = await fetch(`${origin}/api/admin/session`, { headers:{Cookie:cookies}, signal:AbortSignal.timeout(15000) });
    const expected = result.user?.emailVerified ? 200 : 403;
    if (session.status !== expected) throw new Error(`Local admin session check failed (${session.status}) for ${email}`);
    await fetch(`${origin}/api/auth/sign-out`, { method:'POST',headers:{'Content-Type':'application/json',Origin:origin,Cookie:cookies},body:'{}' });
    console.log(JSON.stringify({ email, passwordConfigured:true, passwordSignInVerified:true, emailVerified:Boolean(result.user?.emailVerified),localSessionCheck:true }));
  }
} catch (error) { console.error(error.message); process.exitCode=1; }
finally { password = undefined; await db.end(); }
