import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createPortfolioRouter } from '../navigation.js';

function routerFor(t, hash = '') {
  const dom = new JSDOM('', { url: `https://portfolio.test/${hash}` });
  t.after(() => dom.window.close());
  const visited = [];
  const router = createPortfolioRouter(dom.window, {
    sections: ['departure', 'projects', 'stories', 'arrival'],
    projects: ['braillience', 'autext'],
    stories: ['google-io-2026'],
    onRoute: route => visited.push(route)
  });
  return { window: dom.window, router, visited };
}

test('shared project and story URLs open their exact content on startup', t => {
  for (const [hash, type, id] of [
    ['#projects', 'section', 'projects'],
    ['#project/braillience', 'project', 'braillience'],
    ['#story/google-io-2026', 'story', 'google-io-2026']
  ]) {
    const { router, visited } = routerFor(t, hash);
    router.start();
    assert.deepEqual(visited, [{ type, id }]);
  }
});

test('malformed or unknown URL fragments cannot open arbitrary content or throw', t => {
  for (const hash of ['#project/missing', '#story/google-io-2026/extra', '#constructor/x', '#__proto__/x', '#%E0%A4%A']) {
    const { router, visited } = routerFor(t, hash);
    assert.doesNotThrow(() => router.start());
    assert.deepEqual(visited, []);
    assert.equal(router.navigate({ type: 'project', id: 'missing' }), false);
    assert.equal(router.urlFor({ type: 'constructor', id: 'x' }), null);
  }
});

test('Back and Forward reopen the right view without handling a route twice', async t => {
  const { window, router, visited } = routerFor(t);
  router.start();
  assert.equal(visited.length, 0, 'ordinary startup keeps browser scroll restoration');
  router.navigate({ type: 'section', id: 'projects' });
  router.navigate({ type: 'project', id: 'braillience' });
  const back = new Promise(resolve => window.addEventListener('popstate', resolve, { once: true }));
  window.history.back();
  await back;
  assert.deepEqual(visited.at(-1), { type: 'section', id: 'projects' });
  assert.equal(visited.length, 3);
  const forward = new Promise(resolve => window.addEventListener('popstate', resolve, { once: true }));
  window.history.forward();
  await forward;
  assert.deepEqual(visited.at(-1), { type: 'project', id: 'braillience' });
  assert.equal(visited.length, 4);
});

test('closing a dialog can update its URL without scrolling or reopening content', t => {
  const { window, router, visited } = routerFor(t, '#story/google-io-2026');
  router.start();
  router.navigate({ type: 'section', id: 'stories' }, { replace: true, applyRoute: false });
  assert.equal(window.location.hash, '#stories');
  assert.equal(visited.length, 1);
  assert.equal(router.urlFor({ type: 'story', id: 'google-io-2026' }), 'https://portfolio.test/#story/google-io-2026');
});
