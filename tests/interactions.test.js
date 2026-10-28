import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { bindFlightInput, readingMinutes, readingProgress } from '../interactions.js';

test('reading estimates use text length and progress handles short stories and overscroll', () => {
  assert.equal(readingMinutes(''), 1);
  assert.equal(readingMinutes('word '.repeat(200)), 1);
  assert.equal(readingMinutes('word '.repeat(201)), 2);
  assert.equal(readingProgress(0, 500, 500), 100);
  assert.equal(readingProgress(-20, 1000, 500), 0);
  assert.equal(readingProgress(250, 1000, 500), 50);
  assert.equal(readingProgress(900, 1000, 500), 100);
});

test('diagonal touch steering, cancellation, keyboard overlap, and reset release the right inputs', t => {
  const dom = new JSDOM('<button data-steer="up"></button><button data-steer="right"></button>');
  t.after(() => dom.window.close());
  const { window } = dom;
  const buttons = [...window.document.querySelectorAll('button')];
  let state;
  let enabled = true;
  const input = bindFlightInput(window, buttons, { enabled: () => enabled, onChange: value => { state = value; } });
  const pointer = (target, type, id) => {
    const event = new window.Event(type, { bubbles: true, cancelable: true });
    Object.assign(event, { pointerId: id, button: 0 });
    target.dispatchEvent(event);
  };
  pointer(buttons[0], 'pointerdown', 1);
  pointer(buttons[1], 'pointerdown', 2);
  assert.equal(state.up, true);
  assert.equal(state.right, true);
  window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'w', cancelable: true }));
  pointer(window, 'pointercancel', 1);
  assert.equal(state.up, true, 'the keyboard still holds up');
  pointer(window, 'pointerup', 2);
  assert.equal(state.right, false);
  window.dispatchEvent(new window.KeyboardEvent('keyup', { key: 'w' }));
  assert.equal(state.up, false);
  pointer(buttons[0], 'pointerdown', 3);
  pointer(buttons[0], 'lostpointercapture', 3);
  assert.equal(state.up, false);
  pointer(buttons[1], 'pointerdown', 4);
  input.reset();
  assert.deepEqual(state, { up: false, down: false, left: false, right: false });
  enabled = false;
  pointer(buttons[0], 'pointerdown', 5);
  assert.equal(state.up, false);
});
