// Storage is optional: private browsing and embedded previews may deny access.
export function readHighScore(storage) {
  try {
    const value = Number(storage().getItem('bilal_flight_highscore'));
    return Number.isSafeInteger(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

export function saveHighScore(storage, score) {
  try {
    storage().setItem('bilal_flight_highscore', String(score));
  } catch {
    // Keep the session's score even if persistence is unavailable.
  }
}

export function createDialog(modal, closeButton, background, { onClose = () => {} } = {}) {
  const document = modal.ownerDocument;
  let opener;
  const focusable = () => [...modal.querySelectorAll('button, a[href], input, textarea, [tabindex="0"]')]
    .filter(element => !element.disabled && !element.hidden);

  function close({ notify = true, restoreFocus = true } = {}) {
    if (!modal.classList.contains('active')) return;
    modal.classList.remove('active');
    modal.inert = true;
    modal.setAttribute('aria-hidden', 'true');
    background.forEach(element => { element.inert = false; });
    if (restoreFocus) opener?.focus({ preventScroll: true });
    if (notify) onClose();
  }

  closeButton.addEventListener('click', () => close());
  modal.addEventListener('click', event => {
    if (event.target === modal) close();
  });
  document.addEventListener('keydown', event => {
    if (!modal.classList.contains('active')) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === 'Tab') {
      const controls = focusable();
      const first = controls[0];
      const last = controls.at(-1);
      if (!modal.contains(document.activeElement)) {
        event.preventDefault();
        first?.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  });

  return {
    open(trigger) {
      opener = trigger;
      background.forEach(element => { element.inert = true; });
      modal.inert = false;
      modal.setAttribute('aria-hidden', 'false');
      modal.classList.add('active');
      modal.querySelector('.modal-card').scrollTop = 0;
      closeButton.focus({ preventScroll: true });
    },
    close
  };
}

export function steeringDirection(key) {
  return {
    w: 'up', arrowup: 'up', s: 'down', arrowdown: 'down',
    a: 'left', arrowleft: 'left', d: 'right', arrowright: 'right'
  }[key.toLowerCase()];
}
