import { auth } from '/public/admin-auth.js';
import { setPasswordAccount } from './password.js';
const $ = id => document.getElementById(id);
let otpSent = false, loginMode = 'password', reservations = [], filter = 'all';
const kindLabels = { request: 'Αίτημα από το site', phone: 'Τηλεφωνική κράτηση', block: 'Μη διαθέσιμο' };
const statusLabels = { pending: 'Σε αναμονή επιβεβαίωσης', confirmed: 'Δεσμευμένο', cancelled: 'Ακυρώθηκε · Ημερομηνίες ελεύθερες' };
const dateFormat = value => new Intl.DateTimeFormat('el-GR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value}T12:00:00`));
async function api(path, options) {
  const response = await fetch(`/api/admin${path}`, { ...options, headers: { 'Content-Type': 'application/json' }, cache: 'no-store' });
  const body = await response.json();
  if (!response.ok) {
    if ([401,403].includes(response.status)) { $('dashboard').hidden = true; $('loginPanel').hidden = false; }
    throw new Error(body.error || 'Δεν ήταν δυνατή η ενέργεια.');
  }
  return body;
}
function el(tag, text, className) { const node = document.createElement(tag); node.textContent = text; if (className) node.className = className; return node; }
function render() {
  const items = reservations.filter(item => filter === 'all' || item.property === filter);
  $('reservationList').replaceChildren();
  const pending = items.filter(item => item.status === 'pending').length;
  $('listSummary').textContent = `${items.filter(item => item.status !== 'cancelled').length} ενεργές καταχωρίσεις · ${pending} σε αναμονή`;
  if (!items.length) $('reservationList').append(el('p', 'Δεν υπάρχουν καταχωρίσεις για αυτό το κατάλυμα.', 'admin-empty'));
  for (const item of items) {
    const card = el('article', '', `reservation-item ${item.status}`);
    const top = el('div', '', 'reservation-top'); top.append(el('h3', item.property), el('span', statusLabels[item.status], 'reservation-badge'));
    card.append(top, el('p', `${dateFormat(item.checkin)} → ${dateFormat(item.checkout)}`, 'reservation-dates'), el('p', kindLabels[item.kind], 'reservation-kind'));
    if (item.guest_name) card.append(el('p', item.guest_name));
    if (item.guest_email) { const email = el('a', item.guest_email); email.href = `mailto:${item.guest_email}`; card.append(email); }
    if (item.note) card.append(el('p', item.note, 'reservation-note'));
    if (item.status !== 'cancelled') {
      const actions = el('div', '', 'reservation-actions');
      if (item.status === 'pending') {
        const confirm = el('button', 'Επιβεβαίωση', 'btn primary'); confirm.type = 'button';
        confirm.addEventListener('click', () => change(item.id, 'confirm', confirm)); actions.append(confirm);
      }
      const cancel = el('button', item.kind === 'block' ? 'Επαναφορά διαθεσιμότητας' : 'Ακύρωση & ελευθέρωση', 'btn ghost'); cancel.type = 'button';
      cancel.addEventListener('click', () => {
        if (actions.querySelector('.cancel-question')) return;
        const question = el('div', '', 'cancel-question'); question.append(el('p', 'Να ελευθερωθούν αυτές οι ημερομηνίες;'));
        const yes = el('button', 'Ναι, ελευθέρωση', 'btn primary'); yes.type = 'button'; yes.addEventListener('click', () => change(item.id, 'cancel', yes));
        const no = el('button', 'Επιστροφή', 'btn ghost'); no.type = 'button'; no.addEventListener('click', () => { question.remove(); cancel.focus(); });
        question.append(yes, no); actions.append(question); yes.focus();
      });
      actions.append(cancel); card.append(actions);
    }
    $('reservationList').append(card);
  }
}
async function load() { const result = await api('/reservations'); reservations = result.reservations; render(); }
async function change(id, action, button) {
  button.disabled = true;
  try { await api(`/reservations/${id}`, { method: 'PATCH', body: JSON.stringify({ action }) }); await load(); $('adminStatus').textContent = action === 'cancel' ? 'Οι ημερομηνίες είναι ξανά διαθέσιμες στο site.' : 'Η κράτηση επιβεβαιώθηκε.'; }
  catch (error) { $('adminStatus').textContent = error.message; button.disabled = false; }
}
async function showDashboard() {
  const session = await api('/session');
  setPasswordAccount(session.email);
  $('signedInAs').textContent = session.email; $('loginPanel').hidden = true; $('dashboard').hidden = false;
  await load();
}
function setLoginMode(mode) {
  loginMode = mode; otpSent = false;
  $('otpField').hidden = true; $('changeEmail').hidden = true;
  $('passwordField').hidden = mode !== 'password';
  $('loginForm').elements.password.required = mode === 'password';
  $('loginForm').elements.password.value = '';
  $('loginForm').elements.otp.required = false; $('loginForm').elements.otp.value = '';
  $('loginForm').elements.email.readOnly = false;
  $('loginButton').textContent = mode === 'password' ? 'Σύνδεση' : 'Αποστολή κωδικού';
  $('loginMode').textContent = mode === 'password' ? 'Σύνδεση με κωδικό email' : 'Σύνδεση με κωδικό πρόσβασης';
  $('loginStatus').textContent = '';
}
async function sendCode(email) {
  const { error } = await auth.emailOtp.sendVerificationOtp({ email, type: 'sign-in' });
  if (error) throw new Error(error.message || 'Δεν ήταν δυνατή η αποστολή κωδικού.');
  setLoginMode('otp'); otpSent = true;
  $('otpField').hidden = false; $('changeEmail').hidden = false;
  $('loginForm').elements.otp.required = true; $('loginForm').elements.email.readOnly = true;
  $('loginButton').textContent = 'Σύνδεση';
  $('loginStatus').textContent = 'Ο κωδικός στάλθηκε. Επιβεβαίωσε το email σου για να συνεχίσεις. Έλεγξε και τα ανεπιθύμητα.';
  $('loginForm').elements.otp.focus();
}
$('loginForm').addEventListener('submit', async event => {
  event.preventDefault(); const button = $('loginButton'); button.disabled = true; $('loginStatus').textContent = '';
  try {
    const email = event.target.elements.email.value.trim().toLowerCase();
    if (loginMode === 'password') {
      const { data, error } = await auth.signIn.email({ email, password:event.target.elements.password.value });
      event.target.elements.password.value = '';
      if (error) throw new Error(error.message || 'Έλεγξε τα στοιχεία σύνδεσης.');
      if (!data?.user?.emailVerified) await sendCode(email);
      else await showDashboard();
    } else if (!otpSent) await sendCode(email);
    else {
      const { error } = await auth.signIn.emailOtp({ email, otp: event.target.elements.otp.value.trim() });
      if (error) throw new Error(error.message || 'Ο κωδικός δεν είναι έγκυρος.');
      await showDashboard();
    }
  } catch (error) { $('loginStatus').textContent = error.message; }
  finally { button.disabled = false; }
});
$('changeEmail').addEventListener('click', () => {
  setLoginMode('otp');
});
$('loginMode').addEventListener('click', () => setLoginMode(loginMode === 'password' ? 'otp' : 'password'));
$('logout').addEventListener('click', async () => {
  try { const { error } = await auth.signOut(); if (error) throw new Error('Η αποσύνδεση απέτυχε. Δοκίμασε ξανά.'); location.reload(); }
  catch (error) { $('adminStatus').textContent = error.message; }
});
const form = $('blockForm');
const today = new Intl.DateTimeFormat('en-CA', { timeZone:'Europe/Athens', year:'numeric',month:'2-digit',day:'2-digit' }).format(new Date());
const max = new Date(`${today}T12:00:00Z`); max.setUTCFullYear(max.getUTCFullYear() + 2);
for (const input of form.querySelectorAll('[type="date"]')) { input.min = today; input.max = max.toISOString().slice(0,10); }
form.elements.checkin.addEventListener('change', () => {
  if (!form.elements.checkin.value) return;
  const next = new Date(`${form.elements.checkin.value}T12:00:00Z`); next.setUTCDate(next.getUTCDate() + 1);
  form.elements.checkout.min = next.toISOString().slice(0,10);
});
form.addEventListener('submit', async event => {
  event.preventDefault(); const button = form.querySelector('[type="submit"]'); button.disabled = true; $('adminStatus').textContent = '';
  try {
    await api('/reservations', { method:'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) });
    $('adminStatus').textContent = 'Αποθηκεύτηκε. Οι ημερομηνίες αποκλείστηκαν από το site.';
    form.elements.checkin.value = ''; form.elements.checkout.value = ''; form.elements.checkout.min = today; form.elements.name.value = ''; form.elements.note.value = ''; await load();
  } catch (error) { $('adminStatus').textContent = error.message; }
  finally { button.disabled = false; }
});
document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
  filter = button.dataset.filter; document.querySelectorAll('[data-filter]').forEach(other => other.setAttribute('aria-pressed', String(other === button))); render();
}));
$('refresh').addEventListener('click', () => load().catch(error => $('adminStatus').textContent = error.message));
setInterval(() => { if (!document.hidden && !$('dashboard').hidden) load().catch(error => $('adminStatus').textContent = error.message); }, 30000);
try {
  const response = await fetch('/api/config'); const config = await response.json();
  if (!config.authReady) { $('loginButton').disabled = true; $('loginStatus').textContent = 'Αναμένεται ο ορισμός των email διαχειριστών.'; }
  else await showDashboard().catch(() => {});
} catch { $('loginStatus').textContent = 'Δεν ήταν δυνατή η σύνδεση στην υπηρεσία. Δοκίμασε ξανά.'; }
if (new URLSearchParams(location.search).get('password') === 'changed') {
  $('loginStatus').textContent = 'Ο κωδικός σου άλλαξε επιτυχώς. Συνδέσου με τον νέο προσωπικό κωδικό σου.';
  history.replaceState(null,'',location.pathname);
}
