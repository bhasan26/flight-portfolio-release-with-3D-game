import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import * as THREE from 'three';
import { ThreeScene } from '../three-scene.js';
import { createDialog, readHighScore, saveHighScore, steeringDirection } from '../ui.js';
import { createPortfolioRouter } from '../navigation.js';
import { readingMinutes, readingProgress, bindFlightInput } from '../interactions.js';
import { renderContent } from '../content.js';
import { validateContact } from '../contact.js';
import { CONTACT_ENDPOINT } from '../security-policy.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const source = readFileSync(new URL('../main.js', import.meta.url), 'utf8')
  .replace(/^import .*;\n/gm, '');

function app(t, { compact = false, touch = false, storageDenied = false, reducedMotion = false, hash = '' } = {}) {
  const dom = new JSDOM(html, { url: `https://portfolio.test/${hash}`, runScripts: 'outside-only' });
  const { window } = dom;
  globalThis.document = window.document;
  t.after(() => { dom.window.close(); delete globalThis.document; });
  window.matchMedia = query => ({
    matches: query.includes('max-width') ? compact : query.includes('reduced-motion') ? reducedMotion : touch,
    addEventListener() {}
  });
  window.requestAnimationFrame = () => {};
  window.HTMLElement.prototype.scrollIntoView = function () { window.scrolledTo = this.id; };
  Object.assign(window, { createDialog, readHighScore, saveHighScore, steeringDirection, createPortfolioRouter,
    readingMinutes, readingProgress, bindFlightInput, renderContent, validateContact, CONTACT_ENDPOINT, githubStats: {} });
  if (storageDenied) Object.defineProperty(window, 'localStorage', { get() { throw new Error('Denied'); } });
  const addListener = window.document.addEventListener.bind(window.document);
  window.document.addEventListener = (type, callback, options) => {
    if (type !== 'DOMContentLoaded') addListener(type, callback, options);
  };
  window.eval(source + `\nwindow.app = {
    setupProjectModals, setupStoryModals, setupContactForm, setupScrollControls,
    setupManualFlightTriggers, setupPreloader, initializeThreeScene,
    setupPortfolioRoutes, setupStaticActions,
    setupMotionControls,
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

function fakeFlightScene() {
  return {
    gameActive: false, gamePaused: false, keyboardInput: {},
    toggleGameMode(active) { this.gameActive = active; this.gamePaused = false; },
    setGamePaused(paused) { this.gamePaused = paused; },
    restartGame() { this.gamePaused = false; this.onGameUpdate({ score: 0, energy: 100 }); },
    setAnimationsPaused(paused) { this.animationsPaused = paused; }
  };
}

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

test('direct project and story links populate the right dialog and close without losing context', t => {
  for (const [hash, modalId, expectedTitle, section] of [
    ['#project/braillience', 'project-modal', 'Braillience AI | Bilal Hasan', 'projects'],
    ['#story/google-io-2026', 'story-modal', 'On the Ground at Google I/O 2026 | Bilal Hasan', 'stories']
  ]) {
    const window = app(t, { hash });
    window.app.setupProjectModals();
    window.app.setupStoryModals();
    window.app.setupPortfolioRoutes();
    const modal = window.document.getElementById(modalId);
    assert.equal(modal.classList.contains('active'), true);
    assert.equal(window.document.title, expectedTitle);
    assert.equal(window.document.getElementById('scroll-main').inert, true);
    modal.querySelector('.modal-close-btn').click();
    assert.equal(modal.classList.contains('active'), false);
    assert.equal(window.location.hash, `#${section}`);
    assert.equal(window.document.getElementById('scroll-main').inert, false);
  }
});

test('copy-link controls copy the exact project URL and show a selectable fallback if denied', async t => {
  const window = app(t);
  window.app.setupProjectModals();
  window.app.setupStoryModals();
  window.app.setupStaticActions();
  window.app.setupPortfolioRoutes();
  window.document.querySelector('[data-project="braillience"] button').click();
  const button = window.document.getElementById('copy-project-link');
  let copied;
  Object.defineProperty(window.navigator, 'clipboard', {
    value: { writeText: async value => { copied = value; } }
  });
  button.click();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(copied, 'https://portfolio.test/#project/braillience');
  assert.match(window.document.getElementById('project-share-status').textContent, /Link copied/);
  window.navigator.clipboard.writeText = async () => { throw new Error('Denied'); };
  button.click();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.match(window.document.getElementById('project-share-status').textContent,
    /Copy this link: https:\/\/portfolio.test\/#project\/braillience/);
  window.document.getElementById('close-modal-btn').click();
  window.document.querySelector('[data-nav-section="projects"]').click();
  assert.equal(window.location.hash, '#projects');
  assert.equal(window.scrolledTo, 'projects');
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
  window.fetch = async (url, options) => {
    calls++;
    assert.equal(url, CONTACT_ENDPOINT);
    assert.equal(options.credentials, 'omit');
    assert.equal(options.redirect, 'error');
    assert.equal(options.mode, 'cors');
    assert.equal(JSON.parse(options.body)._gotcha, '');
    return result();
  };
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

test('filled honeypots and oversized contact drafts never trigger a request', t => {
  const window = app(t);
  window.app.setupContactForm();
  const form = window.document.getElementById('customs-contact-form');
  let requests = 0;
  window.fetch = async () => { requests++; return { ok: true }; };
  form.elements.name.value = 'Test Visitor';
  form.elements.email.value = 'visitor@example.com';
  form.elements.message.value = 'A message';
  form.elements._gotcha.value = 'automated field';
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  assert.equal(requests, 0);
  assert.equal(window.document.getElementById('contact-email-fallback').hidden, false);
  form.elements._gotcha.value = '';
  form.elements.message.value = 'x'.repeat(10001);
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  assert.equal(requests, 0);
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
  const scene = fakeFlightScene();
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

test('touch devices can fly, pause, restart after game over, and retain their high score', t => {
  const window = app(t, { compact: true, touch: true });
  const scene = fakeFlightScene();
  window.app.setScene(scene);
  window.app.setupManualFlightTriggers();
  const document = window.document;
  const game = document.getElementById('game-override-btn');
  assert.equal(game.style.display, '');
  game.click();
  const up = document.querySelector('[data-steer="up"]');
  const down = new window.Event('pointerdown', { bubbles: true, cancelable: true });
  Object.assign(down, { pointerId: 7, button: 0 });
  up.dispatchEvent(down);
  assert.equal(scene.keyboardInput.up, true);
  document.getElementById('pause-game-btn').click();
  assert.equal(scene.gamePaused, true);
  assert.equal(scene.keyboardInput.up, false);
  assert.equal(up.disabled, true);
  assert.equal(document.getElementById('pause-game-btn').textContent, 'RESUME');
  document.getElementById('pause-game-btn').click();
  assert.equal(scene.gamePaused, false);
  scene.onGameUpdate({ score: 40, energy: 0, gameOver: true });
  assert.equal(scene.gameActive, true, 'game-over controls remain available');
  assert.equal(scene.gamePaused, true);
  assert.equal(document.getElementById('pause-game-btn').disabled, true);
  document.getElementById('restart-game-btn').click();
  assert.equal(scene.gamePaused, false);
  assert.equal(document.getElementById('game-score').textContent, '0');
  assert.equal(document.getElementById('game-energy').textContent, '100%');
  assert.equal(document.getElementById('game-highscore').textContent, '40');
  window.dispatchEvent(new window.Event('blur'));
  assert.equal(scene.gamePaused, true, 'leaving the window pauses fuel consumption');
  window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'p' }));
  assert.equal(scene.gamePaused, false);
});

test('animation controls synchronize, remember the choice, and work with storage blocked', t => {
  const window = app(t);
  const scene = fakeFlightScene();
  window.app.setScene(scene);
  window.localStorage.setItem('bilal_portfolio_motion_paused', 'true');
  window.app.setupMotionControls();
  assert.equal(scene.animationsPaused, true);
  assert.equal(window.document.body.classList.contains('animations-paused'), true);
  window.document.querySelector('#story-modal .motion-toggle').click();
  assert.equal(scene.animationsPaused, false);
  assert.equal(window.localStorage.getItem('bilal_portfolio_motion_paused'), 'false');
  window.document.querySelectorAll('.motion-toggle').forEach(button => {
    assert.equal(button.getAttribute('aria-pressed'), 'false');
  });
  const restricted = app(t, { storageDenied: true, reducedMotion: true });
  assert.doesNotThrow(() => restricted.app.setupMotionControls());
  assert.equal(restricted.document.body.classList.contains('animations-paused'), true);
  restricted.document.querySelector('.motion-toggle').click();
  assert.equal(restricted.document.body.classList.contains('animations-paused'), false);
});

test('story estimates and reading progress update on scroll and reset for another story', t => {
  const window = app(t);
  window.app.setupStoryModals();
  const document = window.document;
  document.querySelectorAll('.story-card .story-reading-time').forEach(estimate => {
    assert.match(estimate.textContent, /^\d+ MIN READ$/);
  });
  const card = document.querySelector('.story-modal-card');
  Object.defineProperties(card, { scrollHeight: { value: 2000 }, clientHeight: { value: 500 } });
  document.querySelector('[data-story="google-io-2026"] button').click();
  const progress = document.getElementById('story-reading-progress');
  assert.equal(progress.getAttribute('aria-valuenow'), '0');
  card.scrollTop = 750;
  card.dispatchEvent(new window.Event('scroll'));
  assert.equal(progress.getAttribute('aria-valuenow'), '50');
  card.scrollTop = 1500;
  card.dispatchEvent(new window.Event('scroll'));
  assert.equal(progress.getAttribute('aria-valuenow'), '100');
  document.getElementById('close-story-modal-btn').click();
  document.querySelector('[data-story="gdg-year-one"] button').click();
  assert.equal(progress.getAttribute('aria-valuenow'), '0');
  assert.equal(document.getElementById('story-reading-time').textContent, '1 MIN READ');
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

test('paused flight and paused portfolio visuals freeze physics and avoid repeated rendering', () => {
  globalThis.document = { hidden: false };
  globalThis.requestAnimationFrame = () => {};
  try {
    let renders = 0;
    const scene = Object.assign(Object.create(ThreeScene.prototype), {
      gameActive: true, gamePaused: true, needsRender: true, keyboardInput: { up: true },
      planeGroup: new THREE.Group(), camera: new THREE.PerspectiveCamera(),
      gameRings: [], clouds: [], gates: [], gameEnergy: 75, gameScore: 30,
      renderer: { render() { renders++; } }, scene: new THREE.Scene()
    });
    scene.animate(0);
    scene.animate(10000);
    assert.equal(scene.gameEnergy, 75);
    assert.equal(scene.planeGroup.position.z, 0);
    assert.equal(renders, 1, 'a frozen view only repaints when requested');
    scene.setGamePaused(false);
    scene.animate(20000);
    assert.ok(Math.abs(scene.gameEnergy - 74.94) < 0.000001, 'resuming cannot consume time spent paused');
    scene.gameActive = false;
    scene.setAnimationsPaused(true);
    const position = scene.planeGroup.position.clone();
    scene.animate(30000);
    assert.ok(scene.planeGroup.position.equals(position));
  } finally { delete globalThis.document; delete globalThis.requestAnimationFrame; }
});

test('restart resets actual flight physics and replaces rings while preserving the portfolio position', () => {
  const scene = Object.assign(Object.create(ThreeScene.prototype), {
    gameActive: true, gamePaused: true, scrollProgress: 0.5, gameScore: 90, gameEnergy: 0,
    planeGroup: new THREE.Group(), camera: new THREE.PerspectiveCamera(),
    gameRings: [], scene: new THREE.Scene()
  });
  scene.planeGroup.position.set(5, 4, -800);
  scene.restartGame();
  assert.equal(scene.gamePaused, false);
  assert.equal(scene.gameScore, 0);
  assert.equal(scene.gameEnergy, 100);
  assert.equal(scene.planeGroup.position.z, -80);
  assert.equal(scene.gameRings.length, 5);
  scene.restartGame();
  assert.equal(scene.scene.children.length, 5, 'restarting must replace old rings');
  scene.clearGameRings();
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
