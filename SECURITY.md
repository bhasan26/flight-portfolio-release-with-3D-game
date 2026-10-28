# Security review — October 28, 2026

## Scope and results

Reviewed the static application, public assets, shared URL handling, contact form, dependency advisory report, deployment headers, and credential patterns in the working tree, Git history, and compiled JavaScript. The live site was checked with a read-only HTTP header request. No messages or attack payloads were submitted to the live contact endpoint.

- `npm audit`: **0 known vulnerabilities**, including development dependencies.
- `npm test`: **35 tests passed**, including six dedicated security tests.
- `npm run security:check`: security tests and the npm advisory audit passed.
- `npm run build`: passed. The existing large-chunk warning is for the optional Three.js bundle.
- Pattern-based secret scan: no suspected credentials in the scanned working files, 68 historical text blobs, or production JavaScript. Build-token markers were absent from production bundles. Pattern scans can miss unknown credential formats.
- Strict preview response headers were verified over HTTP, and stories and the flight game were checked in Safari under the production CSP.

These results describe the reviewed code and available advisory data; hosting accounts and Formspree administration were not inspected.

## Changes

| Area | Protection |
| --- | --- |
| Project/story content | DOMPurify allows a small HTML subset. Scripts, event handlers, embedded documents, forms, style attributes, and clobbering attributes are removed. Links must use approved URL schemes without embedded credentials; images must remain on this origin. See the [DOMPurify documentation](https://github.com/cure53/DOMPurify). |
| Browser policy | Inline scripts, event attributes, style attributes, object embeds, frames, workers, and media are disallowed. Connections are limited to this origin and the contact endpoint; native form submissions are limited to Formspree. `form-action` needs its own restriction because it does not inherit `default-src`. See [MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/form-action). |
| Visual compatibility | Static styles were moved into CSS files. JavaScript updates individual CSS properties, which remain usable with `style-src-attr 'none'`. See [MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/style-src-attr). |
| Tab isolation | `Cross-Origin-Opener-Policy: same-origin` supplements the existing `noopener noreferrer` external links. |
| Contact handling | Explicit payload limits, invalid-input checks, Formspree's `_gotcha` honeypot, omitted request credentials, a timeout, and rejected redirects. Failed requests keep the draft and offer email fallback. The honeypot follows [Formspree's documented behavior](https://help.formspree.io/articles/building-your-form/honeypot-spam-filtering/). |
| Routing/input | Shared links remain restricted to known IDs, malformed/overlong fragments are ignored, and inherited object properties cannot become steering inputs. |
| Credentials | Environment files, npm credentials, private key containers, and local deployment state are excluded from Git. Existing HSTS, clickjacking, MIME-sniffing, and referrer protections remain. |

## Deployment and provider follow-up

Deploy these changes before relying on the new policies on the public site. The public response inspected during this review still contained the previous policy. After deployment, compare the response with `securityHeaders({ https: true })` in `security-policy.js` and run a real contact delivery check.

In Formspree, confirm **Restrict to Domain** is set to `bilal-swe.vercel.app` and review the active spam/challenge controls and submission limits. These are server-side settings; client validation and the honeypot do not establish rate limiting. Domain restriction uses the referrer, so the existing `strict-origin-when-cross-origin` policy was preserved. See [Formspree's domain-restriction documentation](https://help.formspree.io/articles/form-and-project-settings/restrict-to-domain).

Keep `GITHUB_TOKEN` / `GH_TOKEN` in build-environment secrets. Do not use `VITE_` prefixes for secrets: browser-delivered configuration is public. Any credentials ever exposed through a future commit or deployment require revocation/rotation, even after removal from files.
