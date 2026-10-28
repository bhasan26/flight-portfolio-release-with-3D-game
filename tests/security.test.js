import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { JSDOM } from 'jsdom';
import { renderContent } from '../content.js';
import { validateContact, CONTACT_LIMITS } from '../contact.js';
import { CONTACT_ENDPOINT, contentSecurityPolicy, securityHeaders } from '../security-policy.js';
import { steeringDirection } from '../ui.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('content sanitization rejects executable markup, clobbering, styles, and unsafe links', t => {
  const dom = new JSDOM('<div id="content"></div>', { url: 'https://portfolio.test/' });
  t.after(() => dom.window.close());
  const target = dom.window.document.getElementById('content');
  renderContent(target, `
    <p id="location" name="document" style="position:fixed" onclick="alert(1)">Safe <strong>content</strong></p>
    <script>alert(1)</script><iframe src="https://untrusted.test/"></iframe>
    <form action="https://untrusted.test/"><input name="email"></form>
    <svg onload="alert(1)"><a href="javascript:alert(1)">svg</a></svg>
    <a href="javascript:alert(1)">bad</a>
    <a href="data:text/html,unsafe">data</a>
    <a href="https://user:password@untrusted.test/">credentials</a>
    <a href="http://untrusted.test/">insecure</a>
    <img src="https://untrusted.test/track" onerror="alert(1)" alt="removed external image">
    <a href="https://example.com/" target="_self" rel="opener">Safe link</a>
    <img src="/stories/io-group.jpg" loading="lazy" alt="Safe image">
  `);
  assert.equal(target.querySelector('script,iframe,form,input,svg,[style],[onclick],[onerror],[id],[name]'), null);
  const links = [...target.querySelectorAll('a[href]')];
  assert.equal(links.length, 1);
  assert.equal(links[0].href, 'https://example.com/');
  assert.equal(links[0].rel, 'noopener noreferrer');
  assert.equal(links[0].target, '_blank');
  assert.equal(target.querySelectorAll('img').length, 1);
  assert.equal(target.querySelector('img').src, 'https://portfolio.test/stories/io-group.jpg');
  assert.match(target.textContent, /Safe content/);
});

test('contact validation rejects missing, oversized, malformed, and header-like input', () => {
  const valid = { name: 'Example Visitor', email: 'visitor@example.com', message: 'A message\nwith a new line.' };
  assert.deepEqual(validateContact(valid).fields, valid);
  for (const input of [
    { ...valid, name: '' }, { ...valid, email: 'invalid' },
    { ...valid, name: 'Visitor\r\nBcc: other@example.com' },
    { ...valid, email: 'visitor@example.com\r\nBcc: other@example.com' },
    { ...valid, message: 'null\u0000byte' }, { ...valid, gotcha: 'bot-filled' },
    ...Object.entries(CONTACT_LIMITS).map(([field, limit]) => ({ ...valid, [field]: 'x'.repeat(limit + 1) }))
  ]) assert.ok(validateContact(input).error);
});

test('deployment, preview policy, and HTML agree on CSP and contact destination', t => {
  const dom = new JSDOM(html);
  t.after(() => dom.window.close());
  const document = dom.window.document;
  assert.equal(document.querySelector('meta[http-equiv="Content-Security-Policy"]').content, contentSecurityPolicy());
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  const deployed = Object.fromEntries(config.headers[0].headers.map(({ key, value }) => [key, value]));
  assert.deepEqual(deployed, securityHeaders({ https: true }));
  const policy = deployed['Content-Security-Policy'];
  for (const directive of ["script-src-attr 'none'", "style-src-attr 'none'", "base-uri 'none'", "object-src 'none'",
    "frame-ancestors 'none'", 'form-action https://formspree.io', 'upgrade-insecure-requests']) {
    assert.ok(policy.includes(directive), directive);
  }
  assert.equal(policy.includes('unsafe-inline'), false);
  assert.equal(policy.includes('unsafe-eval'), false);
  assert.equal(securityHeaders()['Content-Security-Policy'].includes('upgrade-insecure-requests'), false,
    'local HTTP preview must not upgrade loopback assets to unavailable HTTPS');
  assert.equal(deployed['Cross-Origin-Opener-Policy'], 'same-origin');
  const form = document.getElementById('customs-contact-form');
  assert.equal(form.action, CONTACT_ENDPOINT);
  assert.equal(form.method, 'post');
  assert.ok(form.elements._gotcha);
});

test('static HTML has no inline handlers/styles and external tabs cannot access their opener', t => {
  const dom = new JSDOM(html);
  t.after(() => dom.window.close());
  const document = dom.window.document;
  assert.equal(document.querySelector('style,[style]'), null);
  document.querySelectorAll('*').forEach(element => {
    [...element.attributes].forEach(attribute => assert.equal(/^on/i.test(attribute.name), false));
  });
  document.querySelectorAll('a[target="_blank"]').forEach(link => {
    assert.ok(link.relList.contains('noopener'));
    assert.ok(link.relList.contains('noreferrer'));
  });
});

test('environment files and credential containers are ignored without hiding the env example', () => {
  const cwd = new URL('../', import.meta.url);
  for (const file of ['.env', '.env.production', '.npmrc', 'private.pem', 'private.key', 'identity.p12']) {
    const result = spawnSync('git', ['check-ignore', '--no-index', '-q', file], { cwd });
    assert.equal(result.status, 0, file);
  }
  assert.equal(spawnSync('git', ['check-ignore', '--no-index', '-q', '.env.example'], { cwd }).status, 1);
});

test('prototype property names cannot become keyboard steering directions', () => {
  for (const key of ['constructor', '__proto__', 'toString']) assert.equal(steeringDirection(key), undefined);
});
