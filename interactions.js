import { steeringDirection } from './ui.js';

export function readingMinutes(text) {
  const words = text.trim().split(/\s+/u).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

export function readingProgress(scrollTop, scrollHeight, clientHeight) {
  const range = scrollHeight - clientHeight;
  return range <= 0 ? 100 : Math.round(Math.max(0, Math.min(1, scrollTop / range)) * 100);
}

// Combine held keys and captured pointers so releasing one finger cannot cancel
// another finger or a keyboard key. Pointer cancellation also releases steering.
export function bindFlightInput(window, buttons, { enabled, onChange }) {
  const keys = new Set();
  const pointers = new Map();
  function publish() {
    const directions = new Set([...keys].map(steeringDirection));
    pointers.forEach(({ direction }) => directions.add(direction));
    onChange(Object.fromEntries(['up', 'down', 'left', 'right'].map(direction => [direction, directions.has(direction)])));
    buttons.forEach(button => {
      const pressed = directions.has(button.dataset.steer);
      button.classList.toggle('pressed', pressed);
      button.setAttribute('aria-pressed', String(pressed));
    });
  }
  function release(event) {
    if (pointers.delete(event.pointerId)) publish();
  }
  buttons.forEach(button => {
    button.addEventListener('pointerdown', event => {
      if (!enabled() || (event.button !== undefined && event.button !== 0)) return;
      event.preventDefault();
      pointers.set(event.pointerId, { direction: button.dataset.steer, button });
      try { button.setPointerCapture?.(event.pointerId); } catch { /* Synthetic or cancelled pointer. */ }
      publish();
    });
    button.addEventListener('lostpointercapture', release);
  });
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);
  window.addEventListener('keydown', event => {
    if (!enabled() || !steeringDirection(event.key)) return;
    event.preventDefault();
    keys.add(event.key.toLowerCase());
    publish();
  });
  window.addEventListener('keyup', event => {
    if (!steeringDirection(event.key)) return;
    if (keys.delete(event.key.toLowerCase())) {
      event.preventDefault();
      publish();
    }
  });
  return {
    reset() {
      const captured = [...pointers.entries()];
      keys.clear();
      pointers.clear();
      captured.forEach(([id, { button }]) => {
        try { if (button.hasPointerCapture?.(id)) button.releasePointerCapture(id); } catch { /* Already released. */ }
      });
      publish();
    }
  };
}
