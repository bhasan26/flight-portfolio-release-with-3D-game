export const CONTACT_ENDPOINT = 'https://formspree.io/f/xovqdbyq';

export function contentSecurityPolicy({ development = false, frameProtection = false, https = false } = {}) {
  const styles = `'self' ${development ? "'unsafe-inline' " : ''}https://fonts.googleapis.com`;
  return [
    "default-src 'self'",
    "script-src 'self'",
    "script-src-attr 'none'",
    `style-src ${styles}`,
    `style-src-elem ${styles}`,
    "style-src-attr 'none'",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self'",
    `connect-src 'self' ${CONTACT_ENDPOINT}${development ? ' ws://127.0.0.1:5173 ws://localhost:5173' : ''}`,
    'form-action https://formspree.io',
    "object-src 'none'",
    "frame-src 'none'",
    "worker-src 'none'",
    "media-src 'none'",
    "base-uri 'none'",
    ...(frameProtection ? ["frame-ancestors 'none'"] : []),
    ...(https ? ['upgrade-insecure-requests'] : [])
  ].join('; ');
}

export function securityHeaders({ development = false, https = false } = {}) {
  return {
    'Content-Security-Policy': contentSecurityPolicy({ development, https, frameProtection: true }),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    ...(https ? { 'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload' } : {})
  };
}
