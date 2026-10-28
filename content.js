import createDOMPurify from 'dompurify';

const purifiers = new WeakMap();
const allowedTags = ['p', 'div', 'span', 'strong', 'em', 'h4', 'ul', 'li', 'img', 'a', 'blockquote'];
const allowedAttributes = ['class', 'src', 'alt', 'href', 'target', 'rel', 'loading', 'decoding'];

function safeURL(value, base, { image = false } = {}) {
  try {
    const url = new URL(value, base);
    const origin = new URL(base).origin;
    if (url.username || url.password) return null;
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    if (image && url.origin !== origin) return null;
    if (url.protocol === 'http:' && url.origin !== origin) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function renderContent(element, markup) {
  const document = element.ownerDocument;
  let purifier = purifiers.get(document);
  if (!purifier) {
    purifier = createDOMPurify(document.defaultView);
    purifiers.set(document, purifier);
  }
  if (!purifier.isSupported) {
    element.textContent = String(markup);
    return;
  }
  const fragment = purifier.sanitize(String(markup), {
    ALLOWED_TAGS: allowedTags,
    ALLOWED_ATTR: allowedAttributes,
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
    RETURN_DOM_FRAGMENT: true
  });
  // DOMPurify removes executable markup; these additional URL rules keep images
  // on this origin and exclude external HTTP links and credential-bearing URLs.
  fragment.querySelectorAll('a').forEach(link => {
    const href = link.getAttribute('href');
    const safe = href && safeURL(href, document.URL);
    if (safe) {
      link.href = safe;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    } else {
      link.removeAttribute('href');
      link.removeAttribute('target');
    }
  });
  fragment.querySelectorAll('img').forEach(image => {
    const src = image.getAttribute('src');
    const safe = src && safeURL(src, document.URL, { image: true });
    if (safe) image.src = safe;
    else image.replaceWith(document.createTextNode(image.alt || ''));
  });
  element.replaceChildren(fragment);
}
