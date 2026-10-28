import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import * as THREE from 'three';
import { ThreeScene } from '../three-scene.js';
import { createDialog, readHighScore, saveHighScore, steeringDirection } from '../ui.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const source = readFileSync(new URL('../main.js', import.meta.url), 'utf8')
  .replace(/^import .*;\n/gm, '');

function app(t, { compact = false, storageDenied = false, reducedMotion = false } = {}) {
  const dom = new JSDOM(html, { url: 'https://portfolio.test/', runScripts: 'outside-only' });
  const { window } = dom;
  globalThis.document = window.document;
  t.after(() => { dom.window.close(); delete globalThis.document; });
  window.matchMedia = query => ({
    matches: query.includes('max-width') ? compact : query.includes('reduced-motion') && reducedMotion,
    addEventListener() {}
  });
  window.requestAnimationFrame = () => {};
  window.HTMLElement.prototype.scrollIntoView = function () { window.scrolledTo = this.id; };
  Object.assign(window, { createDialog, readHighScore, saveHighScore, steeringDirection, githubStats: {} });
  if (storageDenied) Object.defineProperty(window, 'localStorage', { get() { throw new Error('Denied'); } });
  const addListener = window.document.addEventListener.bind(window.document);
  window.document.addEventListener = (type, callback, options) => {
    if (type !== 'DOMContentLoaded') addListener(type, callback, options);
  };
  window.eval(source + `\nwindow.app = {
    setupProjectModals, setupStoryModals, setupContactForm, setupScrollControls,
    setupManualFlightTriggers, setupPreloader, initializeThreeScene,
    setScene(scene) { threeSceneInstance = scene; }
  };`);
  return window;
}

test('storage denial and corrupt scores cannot stop initialization', () => {
  assert.equal(readHighScore(() => { throw new Error('Denied'); }), 0);
  for (const value of ['NaN', '-9', 'Infinity', '1.5', '999999999999999999999']) {
    assert.equal(readHighScore(() => ({ getItem: () => value })), 0);
  }
  assert.equal(readHighScore(() => ({ getItem: () => '120' })), 120);
  assert.doesNotThrow(() => saveHighScore(() => { throw new Error('Denied'); }, 30));
});

test('all project and story dialogs trap focus, close on Escape, and restore the opener', t => {
  const window = app(t);
  const document = window.document;
  window.app.setupProjectModals();
  window.app.setupStoryModals();
  for (const card of document.querySelectorAll('[data-project], [data-story]')) {
    const trigger = card.querySelector('button');
    const modal = document.getElementById(trigger.getAttribute('aria-controls'));
    assert.equal(modal.getAttribute('aria-hidden'), 'true');
    trigger.focus();
    trigger.click();
    assert.equal(modal.inert, false);
    assert.equal(modal.getAttribute('aria-hidden'), 'false');
    assert.equal(document.getElementById('scroll-main').inert, true);
    assert.match(modal.querySelector('h2').textContent, /\S/);
    const controls = modal.querySelectorAll('button, a[href]');
    controls[controls.length - 1].focus();
    const tab = new window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    document.activeElement.dispatchEvent(tab);
    assert.equal(tab.defaultPrevented, true);
    assert.equal(document.activeElement, controls[0]);
    document.activeElement.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.equal(modal.inert, true);
    assert.equal(modal.classList.contains('active'), false);
    assert.equal(document.getElementById('scroll-main').inert, false);
    assert.equal(document.activeElement, trigger);
  }
});

test('Escape closes an open dialog even if browser focus moves to the document', t => {
  const window = app(t);
  window.app.setupProjectModals();
  window.document.querySelector('[data-project] button').click();
  window.document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(window.document.getElementById('project-modal').classList.contains('active'), false);
});

test('compact navigation is inert when closed, selects every section, and closes on Escape', t => {
  const window = app(t, { compact: true });
  window.app.setupScrollControls();
  const document = window.document;
  const nav = document.getElementById('portfolio-nav');
  const toggle = document.getElementById('mobile-nav-toggle');
  assert.equal(nav.inert, true);
  toggle.click();
  assert.equal(nav.inert, false);
  toggle.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(nav.inert, true);
  assert.equal(document.activeElement, toggle);
  for (const button of nav.querySelectorAll('[data-section]')) {
    toggle.click();
    button.click();
    assert.equal(window.scrolledTo, button.dataset.section);
    assert.equal(nav.inert, true);
    assert.equal(toggle.getAttribute('aria-expanded'), 'false');
    assert.equal(document.activeElement.id, button.dataset.section);
  }
});

test('restored scroll positions and page restoration synchronize the HUD immediately', t => {
  const window = app(t);
  const document = window.document;
  const scroller = document.getElementById('scroll-main');
  Object.defineProperties(scroller, {
    scrollHeight: { value: 2000 }, clientHeight: { value: 800 }
  });
  scroller.scrollTop = 600;
  document.querySelectorAll('.portfolio-section').forEach(section => {
    section.getBoundingClientRect = () => section.id === 'projects'
      ? { top: 100, bottom: 800 } : { top: 1000, bottom: 2000 };
  });
  window.app.setupScrollControls();
  assert.equal(document.getElementById('hud-altitude').textContent, '13,500');
  assert.equal(document.querySelector('[aria-current="location"]').dataset.section, 'projects');
  scroller.scrollTop = 1200;
  window.dispatchEvent(new window.Event('pageshow'));
  assert.equal(document.getElementById('hud-altitude').textContent, '27,000');
});

test('WebGL failure releases the loader and leaves portfolio navigation and dialogs usable', async t => {
  const window = app(t, { reducedMotion: true });
  window.console.error = () => {};
  window.app.setupScrollControls();
  window.app.setupProjectModals();
  await window.app.initializeThreeScene(async () => ({
    ThreeScene: class { constructor() { throw new Error('WebGL unavailable'); } }
  }));
  assert.equal(window.document.body.classList.contains('loading-state'), false);
  assert.equal(window.document.getElementById('preloader').getAttribute('aria-hidden'), 'true');
  assert.equal(window.document.getElementById('game-override-btn').style.display, 'none');
  window.document.querySelector('[data-section="arrival"]').click();
  assert.equal(window.scrolledTo, 'arrival');
  window.document.querySelector('[data-project] button').click();
  assert.equal(window.document.getElementById('project-modal').classList.contains('active'), true);
});

test('a delayed 3D import cannot block the portfolio and can enable flight after it loads', async t => {
  const window = app(t);
  let watchdog;
  const schedule = window.setTimeout.bind(window);
  window.setTimeout = (callback, delay) => delay === 2500
    ? (watchdog = callback, 0) : schedule(callback, delay);
  window.setInterval = () => 0;
  window.app.setupPreloader();
  let completeImport;
  const loading = window.app.initializeThreeScene(() => new Promise(resolve => { completeImport = resolve; }));
  assert.equal(window.document.getElementById('game-override-btn').disabled, true);
  watchdog();
  assert.equal(window.document.body.classList.contains('loading-state'), false);
  assert.equal(window.document.getElementById('preloader').style.pointerEvents, 'none');
  completeImport({ ThreeScene: class {} });
  await loading;
  assert.equal(window.document.getElementById('game-override-btn').disabled, false);
});

async function submit(window, result) {
  const form = window.document.getElementById('customs-contact-form');
  form.elements.name.value = 'Test Visitor';
  form.elements.email.value = 'visitor@example.com';
  form.elements.message.value = 'Hello from a local test.';
  let calls = 0;
  window.fetch = async () => { calls++; return result(); };
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(calls, 1, 'duplicate submissions must be blocked');
  assert.equal(form.querySelector('button').disabled, false);
  assert.equal(form.hasAttribute('aria-busy'), false);
  return form;
}

test('contact success resets the form and announces delivery', async t => {
  const window = app(t);
  window.app.setupContactForm();
  const form = await submit(window, () => ({ ok: true }));
  assert.equal(form.elements.message.value, '');
  assert.match(window.document.getElementById('contact-status').textContent, /Message sent/);
  assert.equal(window.document.getElementById('contact-email-fallback').hidden, true);
});

for (const [name, result] of [
  ['HTTP error', () => ({ ok: false, status: 422 })],
  ['network failure', () => { throw new TypeError('Offline'); }],
  ['timeout', () => { throw new DOMException('Timeout', 'AbortError'); }]
]) test(`contact ${name} preserves the draft and offers an explicit email fallback`, async t => {
  const window = app(t);
  window.app.setupContactForm();
  const form = await submit(window, result);
  assert.equal(form.elements.message.value, 'Hello from a local test.');
  assert.match(window.document.getElementById('contact-status').textContent, /not sent/);
  const fallback = window.document.getElementById('contact-email-fallback');
  assert.equal(fallback.hidden, false);
  assert.match(decodeURIComponent(fallback.href), /Hello from a local test/);
});

test('manual flight works without audio or storage, prevents scrolling, and exits with Escape', t => {
  const window = app(t, { storageDenied: true });
  const scene = {
    gameActive: false, keyboardInput: {},
    toggleGameMode(active) { this.gameActive = active; }
  };
  window.app.setScene(scene);
  window.app.setupManualFlightTriggers();
  const document = window.document;
  document.getElementById('game-override-btn').click();
  assert.equal(scene.gameActive, true);
  assert.equal(document.body.classList.contains('game-mode'), true);
  assert.equal(document.getElementById('scroll-main').inert, true);
  assert.equal(document.querySelector('[data-section]').disabled, true);
  const key = new window.KeyboardEvent('keydown', { key: 'ArrowUp', cancelable: true });
  window.dispatchEvent(key);
  assert.equal(key.defaultPrevented, true);
  assert.equal(scene.keyboardInput.up, true);
  window.dispatchEvent(new window.Event('blur'));
  assert.equal(scene.keyboardInput.up, false);
  assert.doesNotThrow(() => scene.onGameUpdate({ score: 10, energy: 50 }));
  window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
  assert.equal(scene.gameActive, false);
  assert.equal(document.getElementById('scroll-main').inert, false);
  assert.equal(document.querySelector('[data-section]').disabled, false);
  document.getElementById('game-override-btn').click();
  assert.equal(document.getElementById('game-score').textContent, '0');
  document.getElementById('exit-game-btn').click();
  assert.equal(scene.gameActive, false);
});

test('game physics consumes the same fuel and distance at 30, 60, and 144 Hz', () => {
  globalThis.document = { hidden: false };
  globalThis.requestAnimationFrame = () => {};
  try {
    const results = [30, 60, 144].map(hz => {
      const scene = Object.assign(Object.create(ThreeScene.prototype), {
        gameActive: true, reducedMotion: false, keyboardInput: {},
        planeGroup: new THREE.Group(), camera: new THREE.PerspectiveCamera(),
        gameRings: [], clouds: [], gates: [], gameEnergy: 100, gameScore: 0,
        renderer: { render() {} }, scene: new THREE.Scene()
      });
      for (let frame = 0; frame <= hz; frame++) scene.animate(frame * 1000 / hz);
      return { energy: scene.gameEnergy, z: scene.planeGroup.position.z };
    });
    for (const result of results) {
      assert.ok(Math.abs(result.energy - results[0].energy) < 0.000001);
      assert.ok(Math.abs(result.z - results[0].z) < 0.000001);
    }
  } finally { delete globalThis.document; delete globalThis.requestAnimationFrame; }
});

test('game ring cleanup releases shared GPU resources exactly once', () => {
  const scene = Object.assign(Object.create(ThreeScene.prototype), { scene: new THREE.Scene(), gameRings: [] });
  const geometry = new THREE.TorusGeometry();
  const material = new THREE.MeshBasicMaterial();
  let geometryDisposals = 0, materialDisposals = 0;
  geometry.addEventListener('dispose', () => geometryDisposals++);
  material.addEventListener('dispose', () => materialDisposals++);
  scene.gameRings = [new THREE.Mesh(geometry, material), new THREE.Mesh(geometry, material)];
  scene.gameRings.forEach(ring => scene.scene.add(ring));
  scene.clearGameRings();
  assert.equal(geometryDisposals, 1);
  assert.equal(materialDisposals, 1);
  assert.equal(scene.gameRings.length, 0);
});

test('all local links, images, section targets, and story assets resolve', () => {
  const dom = new JSDOM(html);
  try {
    const ids = [...dom.window.document.querySelectorAll('[id]')].map(element => element.id);
    assert.equal(new Set(ids).size, ids.length, 'IDs must be unique');
    for (const element of dom.window.document.querySelectorAll('[href], [src], [data-section]')) {
      const rawPath = element.dataset.section ? `#${element.dataset.section}` : element.getAttribute('href') || element.getAttribute('src');
      const path = rawPath.split('?')[0];
      if (path.startsWith('#') && path.length > 1) assert.ok(ids.includes(path.slice(1)), path);
      if (path.startsWith('/') && !path.startsWith('//')) {
        assert.ok(existsSync(new URL(`..${path}`, import.meta.url)) || existsSync(new URL(`../public${path}`, import.meta.url)), path);
      }
    }
    for (const [, path] of source.matchAll(/(?:src=|cover: )['"](\/[^'"]+)['"]/g)) {
      assert.ok(existsSync(new URL(`../public${path}`, import.meta.url)), path);
    }
  } finally { dom.window.close(); }
});
