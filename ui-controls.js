// Branded form controls. Native fields remain the source of values and validation.
(() => {
  const form = document.getElementById('bookingForm');
  if (!form) return;
  const widgets = [];
  const iso = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const parse = value => new Date(`${value}T12:00:00`);
  const notify = input => input.dispatchEvent(new Event('change', { bubbles: true }));
  const makeButton = (label, className) => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = className; button.textContent = label;
    return button;
  };
  function closeAll(except) {
    widgets.forEach(widget => {
      if (widget === except) return;
      widget.panel.hidden = true;
      widget.trigger.setAttribute('aria-expanded', 'false');
    });
  }
  function makeWidget(input, label, type) {
    const holder = document.createElement('span');
    holder.className = `field-widget ${type}-widget`;
    input.before(holder); holder.append(input);
    input.classList.add('control-source'); input.tabIndex = -1;
    input.setAttribute('aria-hidden', 'true');
    const trigger = makeButton('', 'field-trigger');
    trigger.setAttribute('aria-label', label);
    trigger.setAttribute('aria-expanded', 'false');
    const panel = document.createElement('span');
    panel.className = 'field-popover'; panel.hidden = true;
    panel.id = `${input.name}-popover`;
    trigger.setAttribute('aria-controls', panel.id);
    holder.append(trigger, panel);
    const widget = { input, holder, trigger, panel };
    widgets.push(widget);
    trigger.addEventListener('click', () => {
      const opening = panel.hidden;
      closeAll(); panel.hidden = !opening;
      trigger.setAttribute('aria-expanded', String(opening));
      if (opening) widget.open?.();
    });
    holder.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        event.preventDefault(); closeAll(); trigger.focus();
      }
    });
    holder.addEventListener('keydown', event => {
      if (event.key === 'Tab') {
        window.setTimeout(() => { if (!holder.contains(document.activeElement)) closeAll(); }, 0);
      }
    });
    input.addEventListener('invalid', event => {
      event.preventDefault(); trigger.setAttribute('aria-invalid', 'true');
      trigger.focus();
      document.getElementById('formNote').textContent = input.validationMessage || 'Συμπλήρωσε τα απαραίτητα πεδία.';
    });
    input.addEventListener('change', () => trigger.removeAttribute('aria-invalid'));
    return widget;
  }

  const select = form.querySelector('select');
  const choice = makeWidget(select, 'Κατάλυμα', 'select');
  choice.trigger.setAttribute('role', 'combobox');
  choice.trigger.setAttribute('aria-haspopup', 'listbox');
  choice.panel.setAttribute('role', 'listbox');
  choice.panel.setAttribute('aria-label', 'Κατάλυμα');
  const options = [...select.options].map((option, index) => {
    const button = makeButton(option.textContent, 'field-option');
    button.setAttribute('role', 'option');
    button.addEventListener('click', () => {
      select.selectedIndex = index; notify(select); closeAll(); choice.trigger.focus();
    });
    choice.panel.append(button);
    return button;
  });
  const syncSelect = () => {
    choice.trigger.textContent = select.selectedOptions[0].textContent;
    options.forEach((button, index) => button.setAttribute('aria-selected', String(index === select.selectedIndex)));
  };
  select.addEventListener('change', syncSelect); syncSelect();
  choice.open = () => options[select.selectedIndex].focus();
  choice.holder.addEventListener('keydown', event => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    closeAll(choice); choice.panel.hidden = false;
    choice.trigger.setAttribute('aria-expanded', 'true');
    let index = options.indexOf(document.activeElement);
    if (index < 0) index = select.selectedIndex;
    index = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
    options[index].focus();
  });

  const dates = [...form.querySelectorAll('input[type="date"]')];
  const today = parse(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Athens', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date()));
  dates.forEach((input, index) => {
    input.min = iso(today);
    const latest = new Date(today); latest.setFullYear(latest.getFullYear() + 2);
    input.max = iso(latest);
    const label = index ? 'Αναχώρηση' : 'Άφιξη';
    const widget = makeWidget(input, label, 'date');
    widget.trigger.setAttribute('aria-haspopup', 'dialog');
    widget.panel.setAttribute('role', 'dialog');
    widget.panel.setAttribute('aria-label', `Ημερολόγιο: ${label}`);
    let month = new Date(today.getFullYear(), today.getMonth(), 1, 12);
    const syncDate = () => {
      widget.trigger.textContent = input.value ? new Intl.DateTimeFormat('el-GR', { day: 'numeric', month: 'short', year: 'numeric' }).format(parse(input.value)) : 'Επίλεξε ημερομηνία';
    };
    const render = () => {
      widget.panel.replaceChildren();
      const header = document.createElement('span'); header.className = 'calendar-header';
      const title = document.createElement('span');
      title.textContent = new Intl.DateTimeFormat('el-GR', { month: 'long', year: 'numeric' }).format(month);
      title.setAttribute('aria-live', 'polite');
      const previous = makeButton('‹', 'calendar-nav'); previous.setAttribute('aria-label', 'Προηγούμενος μήνας');
      const next = makeButton('›', 'calendar-nav'); next.setAttribute('aria-label', 'Επόμενος μήνας');
      const minimum = parse(input.min);
      const maximum = parse(input.max);
      previous.disabled = month.getFullYear() === minimum.getFullYear() && month.getMonth() <= minimum.getMonth();
      next.disabled = month.getFullYear() === maximum.getFullYear() && month.getMonth() >= maximum.getMonth();
      previous.addEventListener('click', () => { month.setMonth(month.getMonth() - 1); render(); widget.panel.querySelector('.calendar-nav:not(:disabled)').focus(); });
      next.addEventListener('click', () => { month.setMonth(month.getMonth() + 1); render(); widget.panel.querySelectorAll('.calendar-nav')[1].focus(); });
      header.append(previous, title, next); widget.panel.append(header);
      const grid = document.createElement('span'); grid.className = 'calendar-grid';
      ['Δ', 'Τ', 'Τ', 'Π', 'Π', 'Σ', 'Κ'].forEach(day => { const span = document.createElement('span'); span.className = 'calendar-weekday'; span.textContent = day; grid.append(span); });
      const offset = (month.getDay() + 6) % 7;
      for (let i = 0; i < offset; i++) { const blank = document.createElement('span'); blank.setAttribute('aria-hidden', 'true'); grid.append(blank); }
      const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
      for (let day = 1; day <= count; day++) {
        const value = iso(new Date(month.getFullYear(), month.getMonth(), day, 12));
        const button = makeButton(String(day), 'calendar-day');
        const unavailable = window.elementsBooking?.unavailable(input.name, value);
        button.disabled = value < input.min || value > input.max || Boolean(unavailable);
        if (unavailable && value >= input.min && value <= input.max) { button.classList.add('is-unavailable'); button.title = 'Μη διαθέσιμη ημερομηνία'; }
        button.setAttribute('aria-label', new Intl.DateTimeFormat('el-GR', { dateStyle: 'full' }).format(parse(value)));
        button.setAttribute('aria-pressed', String(value === input.value));
        if (value === iso(today)) button.classList.add('is-today');
        button.addEventListener('click', () => { input.value = value; notify(input); closeAll(); widget.trigger.focus(); });
        grid.append(button);
      }
      widget.panel.append(grid);
    };
    widget.open = () => {
      const anchor = parse(input.value || input.min);
      month = new Date(anchor.getFullYear(), anchor.getMonth(), 1, 12);
      render();
      (widget.panel.querySelector('[aria-pressed="true"]:not(:disabled)') || widget.panel.querySelector('.calendar-day:not(:disabled)') || widget.panel.querySelector('.calendar-nav:not(:disabled)'))?.focus();
    };
    widget.panel.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      const buttons = [...widget.panel.querySelectorAll('.calendar-day')];
      const current = buttons.indexOf(document.activeElement);
      if (current < 0) return;
      event.preventDefault();
      const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
      const target = buttons[current + delta];
      if (target && !target.disabled) target.focus();
    });
    input.addEventListener('change', syncDate); syncDate();
    document.addEventListener('elements:availability', () => { if (!widget.panel.hidden) render(); });
  });
  dates[0].addEventListener('change', () => {
    const nextDay = parse(dates[0].value || iso(today)); nextDay.setDate(nextDay.getDate() + 1);
    dates[1].min = iso(nextDay);
    if (dates[1].value && dates[1].value < dates[1].min) { dates[1].value = ''; notify(dates[1]); }
  });

  const number = form.querySelector('input[type="number"]');
  number.setAttribute('aria-label', 'Επισκέπτες');
  const counter = document.createElement('span'); counter.className = 'guest-counter';
  number.before(counter);
  const minus = makeButton('−', 'counter-button'); minus.setAttribute('aria-label', 'Λιγότεροι επισκέπτες');
  const plus = makeButton('+', 'counter-button'); plus.setAttribute('aria-label', 'Περισσότεροι επισκέπτες');
  counter.append(minus, number, plus);
  const syncCounter = () => { minus.disabled = +number.value <= +number.min; plus.disabled = +number.value >= +number.max; };
  minus.addEventListener('click', () => { number.stepDown(); notify(number); });
  plus.addEventListener('click', () => { number.stepUp(); notify(number); });
  number.addEventListener('input', syncCounter); number.addEventListener('change', syncCounter); syncCounter();
  document.addEventListener('pointerdown', event => { if (!event.target.closest('.field-widget')) closeAll(); });
  window.addEventListener('hashchange', () => closeAll());
  window.addEventListener('popstate', () => closeAll());
})();
