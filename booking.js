(() => {
  const form = document.getElementById('bookingForm');
  if (!form) return;
  const property = form.elements.property;
  const checkin = form.elements.checkin;
  const checkout = form.elements.checkout;
  const note = document.getElementById('formNote');
  const availabilityNote = document.getElementById('availabilityNote');
  const submit = form.querySelector('[type="submit"]');
  const phones = { SkouZen: ['697 087 8029', '+306970878029', 2], Ivory: ['697 087 8029', '+306970878029', 2], Pearl: ['210 452 0279', '+302104520279', 4] };
  let blocked = new Set(), ready = false, sending = false, request = 0;
  const notify = input => input.dispatchEvent(new Event('change', { bubbles: true }));
  const unavailable = (field, date) => {
    if (!ready) return true;
    if (field === 'checkin') return blocked.has(date);
    if (!checkin.value) return false;
    return date <= checkin.value || [...blocked].some(day => day >= checkin.value && day < date);
  };
  window.elementsBooking = { unavailable };
  function validateDates() {
    checkin.setCustomValidity(checkin.value && ready && unavailable('checkin', checkin.value) ? 'Η ημέρα άφιξης δεν είναι διαθέσιμη.' : '');
    checkout.setCustomValidity(checkout.value && ready && unavailable('checkout', checkout.value) ? 'Η διαμονή περιλαμβάνει μη διαθέσιμες νύχτες. Επίλεξε άλλες ημερομηνίες.' : '');
    if (checkin.value && checkin.validationMessage || checkout.value && checkout.validationMessage) {
      availabilityNote.textContent = checkin.validationMessage || checkout.validationMessage;
    } else if (ready) availabilityNote.textContent = 'Οι μη διαθέσιμες νύχτες είναι απενεργοποιημένες στο ημερολόγιο. Η διαθεσιμότητα ελέγχεται ξανά στην αποστολή.';
  }
  async function refresh() {
    const current = ++request, selected = property.value;
    ready = false; submit.disabled = true;
    availabilityNote.textContent = 'Έλεγχος διαθεσιμότητας…';
    try {
      const [response, configuration] = await Promise.all([
        fetch(`/api/availability?property=${encodeURIComponent(selected)}`, { cache: 'no-store', signal: AbortSignal.timeout(15000) }),
        fetch('/api/config', { cache: 'no-store', signal: AbortSignal.timeout(15000) })
      ]);
      const result = await response.json();
      const config = await configuration.json();
      if (!response.ok) throw new Error(result.error);
      if (current !== request) return;
      blocked = new Set(result.dates); ready = true;
      validateDates(); submit.disabled = sending || !config.bookingReady;
      if (!config.bookingReady) availabilityNote.textContent = 'Για την ώρα οι κρατήσεις γίνονται τηλεφωνικά. Κάλεσε στο τηλέφωνο του καταλύματος που επέλεξες.';
    } catch {
      if (current !== request) return;
      availabilityNote.textContent = 'Δεν μπορέσαμε να ελέγξουμε τη διαθεσιμότητα. Δοκίμασε ξανά ή κάλεσε στο τηλέφωνο του καταλύματος.';
    }
    document.dispatchEvent(new Event('elements:availability'));
  }
  function syncProperty() {
    const [display, phone, capacity] = phones[property.value];
    const link = document.getElementById('bookingPhone');
    link.href = `tel:${phone}`; link.replaceChildren();
    const label = document.createElement('span'); label.textContent = `Τηλέφωνο ${property.value === 'Pearl' ? 'αποκλειστικά ' : ''}για το ${property.value}`;
    const number = document.createElement('strong'); number.textContent = display; link.append(label, number);
    form.elements.guests.max = String(capacity);
    if (+form.elements.guests.value > capacity) form.elements.guests.value = String(capacity);
    notify(form.elements.guests);
    note.textContent = ''; checkin.value = ''; checkout.value = ''; notify(checkin); notify(checkout);
    refresh();
  }
  property.addEventListener('change', syncProperty);
  checkin.addEventListener('change', validateDates); checkout.addEventListener('change', validateDates);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!ready || sending || !form.reportValidity()) return;
    sending = true; submit.disabled = true; submit.textContent = 'Καταχώριση…'; note.textContent = '';
    try {
      const response = await fetch('/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(form))), signal: AbortSignal.timeout(20000) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Το αίτημα δεν καταχωρίστηκε.');
      note.textContent = `${result.message} Κωδικός: ${result.id.slice(0, 8).toUpperCase()}. Δεν αποστέλλεται αυτόματο email· για επικοινωνία χρησιμοποίησε το τηλέφωνο του καταλύματος.`;
      form.classList.add('sent'); checkin.value = ''; checkout.value = ''; notify(checkin); notify(checkout);
    } catch (error) {
      note.textContent = error.name === 'TimeoutError' || error instanceof TypeError ? 'Η σύνδεση διακόπηκε. Πριν επαναλάβεις το αίτημα, επικοινώνησε τηλεφωνικά για να ελέγξουμε αν καταχωρίστηκε.' : error.message;
    } finally { sending = false; submit.textContent = 'Αποστολή αιτήματος'; await refresh(); }
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && location.hash === '#book') refresh(); });
  window.addEventListener('hashchange', () => { if (location.hash === '#book') refresh(); });
  setInterval(() => { if (!document.hidden && location.hash === '#book' && !sending) refresh(); }, 30000);
  syncProperty();
})();
