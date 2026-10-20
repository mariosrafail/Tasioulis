import { auth } from '/public/admin-auth.js';
const form = document.getElementById('changePasswordForm');
const fields = document.getElementById('changePasswordFields');
const send = document.getElementById('sendPasswordCode');
const status = document.getElementById('passwordChangeStatus');
let accountEmail = '', sending = false;

export function setPasswordAccount(email) {
  accountEmail = email.toLowerCase();
  document.getElementById('passwordAccountEmail').textContent = accountEmail;
  form.reset(); fields.hidden = true; fields.disabled = true; status.textContent = '';
  send.textContent = 'Αποστολή κωδικού επιβεβαίωσης';
}
send.addEventListener('click', async () => {
  if (sending || !accountEmail) return;
  sending = true; send.disabled = true; status.textContent = '';
  try {
    const { error } = await auth.forgetPassword.emailOtp({ email:accountEmail });
    if (error) throw new Error(error.message || 'Δεν ήταν δυνατή η αποστολή κωδικού. Δοκίμασε ξανά.');
    form.reset(); fields.hidden = false; fields.disabled = false;
    status.textContent = `Ο κωδικός επιβεβαίωσης στάλθηκε στο ${accountEmail}. Έλεγξε και τα ανεπιθύμητα.`;
    send.textContent = 'Αποστολή νέου κωδικού'; form.elements.otp.focus();
  } catch (error) { status.textContent = error.message; }
  finally { sending = false; send.disabled = false; }
});
form.addEventListener('submit', async event => {
  event.preventDefault();
  const submit = form.querySelector('[type="submit"]');
  if (submit.disabled || fields.disabled) return;
  if (form.elements.password.value !== form.elements.confirmation.value) { status.textContent = 'Οι δύο κωδικοί πρέπει να είναι ίδιοι.'; return; }
  submit.disabled = true; send.disabled = true; status.textContent = 'Επιβεβαίωση αλλαγής…';
  let changed = false;
  try {
    const { error } = await auth.emailOtp.resetPassword({ email:accountEmail, otp:form.elements.otp.value.trim(), password:form.elements.password.value });
    if (error) throw new Error(error.message || 'Ο κωδικός επιβεβαίωσης δεν είναι έγκυρος ή έχει λήξει. Ζήτησε νέο.');
    changed = true; form.reset(); fields.disabled = true; fields.hidden = true;
    status.textContent = 'Ο κωδικός άλλαξε επιτυχώς. Αποσύνδεση…';
    const { error: logoutError } = await auth.signOut();
    if (logoutError) throw new Error('Ο κωδικός άλλαξε. Πάτησε «Αποσύνδεση» και συνδέσου με τον νέο κωδικό σου.');
    location.assign('/admin?password=changed');
  } catch (error) { status.textContent = error.message; }
  finally {
    form.elements.password.value = ''; form.elements.confirmation.value = '';
    if (!changed) submit.disabled = false;
    send.disabled = false;
  }
});
