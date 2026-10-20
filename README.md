# Elements

Static destination/property pages with a Node.js API, Neon Postgres availability,
and a private `/admin` dashboard using Managed Neon Auth email codes.

## Run

Use Node.js 22+ (24 LTS recommended).

```sh
npm ci
cp .env.example .env.local
# Set the database URLs, Neon Auth URL and comma-separated ADMIN_EMAILS.
npm run migrate
npm run build
npm start
```

Open `http://127.0.0.1:18764`. The server must handle both `/api/*` and `/admin`.
A Python static server or GitHub Pages alone cannot run the booking system.
The server serves an explicit list of public files; it never serves `.env` files,
the server source or database migrations.

## Neon project

- Project: `Elements` / `round-boat-60144743`, Frankfurt.
- Production branch: `br-bold-grass-b9bqubbd`, database `elements`.
- Isolated development branch: `br-young-frog-b9hbdd0c`.
- Configuration and credentials are in gitignored `.env.local` files.
- `DATABASE_URL` is pooled. Migrations require the separate unpooled URL.
- Managed Neon Auth is enabled on production. Only verified emails explicitly
  listed in server-side `ADMIN_EMAILS` may use the admin API.
- The owner's two authorized emails are configured privately in `.env.local`.
  Login at `/admin` with email/password or a six-digit email code. Unverified
  accounts complete email-code verification before the API grants access.
- `/admin/reset-password` requests a short-lived, one-use Neon password setup/reset
  link sent to the authorized mailbox. Passwords are entered by the owner in that
  page, never in chat, source files or environment variables. The reset token is
  removed from the address bar after successful use; the page sends no referrer.
  Reloading before submission keeps the form usable. Request redirects are
  fixed by the server to the configured `APP_ORIGIN`; clients cannot override them.
- Every signed-in administrator has **Ο λογαριασμός μου → Αλλαγή κωδικού**.
  The app sends a one-use password-reset OTP to that session's email, then submits
  the OTP and new password to Managed Auth. The server rejects attempts to target
  a different account, even if that email is another administrator. A successful
  change signs out that browser so the user logs back in with the new password.
- Online submissions remain closed until at least one admin email is configured;
  guests can still see availability and the correct property phone number.

## Reservations

- The contact numbers are distinct: SkouZen/Ivory `6970878029`, Pearl `2104520279`.
- Online submissions create **pending requests**, not automatically confirmed stays.
  Pending requests reserve their nights until an administrator confirms or cancels them.
- There is no automatic booking email or payment flow. All requests appear in `/admin`;
  managers contact guests using the supplied email or the property's phone number.
- Admins can create a telephone booking or block dates, and can cancel/release them.
- Arrival is inclusive; departure is exclusive. Example: 10–12 October blocks the
  nights of 10 and 11 October, leaving 12 October available for a new arrival.
- Both flows use the same transaction and `occupied_nights` primary key. The database
  rejects overlaps even when requests arrive simultaneously. A failed transaction
  leaves no partial reservation. Cancellation releases nights and retains an audit log.
- Public availability returns only dates and property names. Guest details and notes
  are restricted to the admin API, with origin checks and request rate limits.
- The public calendar refreshes on opening the booking page and every 30 seconds
  while visible. Submission always rechecks availability atomically in the database.

## Tests

```powershell
$env:ENV_FILE='.env.development.local'
npm test
```

The database integration tests only run when `ENV_FILE` explicitly names the isolated
development file. They create test reservations on that branch and cancel them after
each test. Production is not used for test reservations. Tests cover concurrent
bookings, telephone/web conflicts, departure-day turnover, cancellation, authorization,
origin checks, and private-file exposure.

## Hosting

### Netlify

The existing project is `elementssrooms` at `https://elementssrooms.netlify.app`.
`netlify.toml` builds the frontend into `dist/`, and `/api/*` is handled by the
Express adapter in `netlify/functions/api.mjs`. Only explicitly selected public
files are copied into `dist/`; server sources, password maintenance scripts,
original photo backups and environment files are excluded.

The production environment variables are managed privately in Netlify:
`DATABASE_URL`, `NEON_AUTH_BASE_URL`, `ADMIN_EMAILS`, `APP_ORIGIN`, `NODE_ENV`.
Do not put their values in `netlify.toml` or Git. `APP_ORIGIN` must match the HTTPS
public origin, which must also be registered in Neon Auth trusted domains.
Production uses the existing production database and accounts; no migration or
account recreation is needed during deployment. Migrations run separately.

Future pushes to `main` use `npm run build`, publish `dist/`, and package
`netlify/functions/`. Local development still uses `npm start`.

### Other Node hosts

Deploy on a Node-compatible host using `npm ci && npm run build`, then `npm start`.
Set `HOST=0.0.0.0`, `NODE_ENV=production`, the host's `PORT`, the public HTTPS
`APP_ORIGIN`, both database URLs, `NEON_AUTH_BASE_URL`, and `ADMIN_EMAILS` as host
secrets. Register the public origin in Neon Auth trusted domains before login.
Configure custom SMTP in Neon Auth for production delivery. The local setup uses
Neon's managed development email delivery. Do not upload `.env.local` or source
transfer backups. Run migrations as a separate release step.

The linked Netlify project deploys pushes to `main` automatically. Other hosts
need their own deployment configuration.
