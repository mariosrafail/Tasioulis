import { auth } from '/public/admin-auth.js';
const requestForm = document.getElementById('requestForm');
const resetForm = document.getElementById('resetForm');
const status = document.getElementById('resetStatus');
const params = new URLSearchParams(location.search);
let token = params.get('token');
if (params.has('error')) history.replaceState(null, '', location.pathname);
if (token) { requestForm.hidden = true; resetForm.hidden = false; }
if (params.has('error')) status.textContent = 'Ο σύνδεσμος έληξε ή δεν είναι έγκυρος. Ζήτησε νέο σύνδεσμο.';
requestForm.addEventListener('submit', async event => {
  event.preventDefault(); const button = requestForm.querySelector('button'); button.disabled = true; status.textContent = '';
  try {
    const { error } = await auth.requestPasswordReset({ email: requestForm.elements.email.value.trim().toLowerCase(), redirectTo:`${location.origin}/admin/reset-password` });
    if (error) throw new Error(error.message || 'Δεν ήταν δυνατή η αποστολή συνδέσμου.');
    status.textContent = 'Ο προσωρινός σύνδεσμος στάλθηκε στο email σου. Έλεγξε και τα ανεπιθύμητα. Άνοιξέ τον σε αυτόν τον υπολογιστή.';
  } catch (error) { status.textContent = error.message; }
  finally { button.disabled = false; }
});
resetForm.addEventListener('submit', async event => {
  event.preventDefault(); const button = resetForm.querySelector('button');
  if (resetForm.elements.password.value !== resetForm.elements.confirmation.value) { status.textContent = 'Οι δύο κωδικοί πρέπει να είναι ίδιοι.'; return; }
  button.disabled = true; status.textContent = '';
  try {
    const { error } = await auth.resetPassword({ token, newPassword:resetForm.elements.password.value });
    if (error) throw new Error(error.message || 'Ο σύνδεσμος έληξε ή δεν είναι έγκυρος. Ζήτησε νέο σύνδεσμο.');
    token = null; history.replaceState(null, '', location.pathname); resetForm.hidden = true;
    status.textContent = 'Ο κωδικός σου αποθηκεύτηκε. Συνδέσου στη διαχείριση. Στην πρώτη σύνδεση θα επιβεβαιώσεις το email σου με έναν κωδικό email.';
  } catch (error) { status.textContent = error.message; }
  finally { resetForm.elements.password.value = ''; resetForm.elements.confirmation.value = ''; button.disabled = false; }
});
