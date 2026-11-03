import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const origin = 'https://www.bhasan.online';
const files = ['index.html', ...['coverage-guard', 'braillience', 'cricket-shadow-coach'].map(slug => `projects/${slug}/index.html`)];

test('sitemap and all pages agree on unique custom-domain canonicals and metadata', () => {
  const sitemap = readFileSync(new URL('../public/sitemap.xml', import.meta.url), 'utf8');
  const listed = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]);
  const urls = [];
  const titles = [];
  for (const file of files) {
    const dom = new JSDOM(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'));
    try {
      const doc = dom.window.document;
      const url = origin + '/' + file.replace(/index\.html$/, '');
      urls.push(url);
      titles.push(doc.title);
      assert.equal(doc.querySelector('link[rel="canonical"]').href, url);
      assert.equal(doc.querySelector('meta[property="og:url"]').content, url);
      assert.ok(doc.querySelector('meta[name="description"]').content.length > 70);
      assert.equal(doc.querySelectorAll(file === 'index.html' ? '#departure h1' : 'main h1').length, 1);
      assert.ok(doc.title.includes('Bilal Hasan'));
      const schema = JSON.parse(doc.querySelector('script[type="application/ld+json"]').textContent);
      assert.equal(schema['@context'], 'https://schema.org');
      assert.ok(JSON.stringify(schema).includes(url));
      assert.ok(!doc.documentElement.outerHTML.includes('bilal-swe.vercel.app'));
      for (const link of doc.querySelectorAll('a[href^="/projects/"]')) {
        assert.ok(existsSync(new URL(`..${link.getAttribute('href')}index.html`, import.meta.url)));
      }
    } finally { dom.window.close(); }
  }
  assert.equal(new Set(titles).size, files.length);
  assert.deepEqual(listed.sort(), urls.sort());
  assert.ok(readFileSync(new URL('../public/robots.txt', import.meta.url), 'utf8').includes(`Sitemap: ${origin}/sitemap.xml`));
});

test('canonical redirect targets only the legacy production hostname', () => {
  const { redirects } = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.deepEqual(redirects, [{
    source: '/:path*', has: [{ type: 'host', value: 'bilal-swe\\.vercel\\.app' }],
    destination: `${origin}/:path*`, permanent: true
  }]);
});
