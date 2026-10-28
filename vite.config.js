import { defineConfig } from 'vite';
import { contentSecurityPolicy, securityHeaders } from './security-policy.js';

export default defineConfig({
  plugins: [{
    name: 'local-development-csp',
    apply: 'serve',
    transformIndexHtml(html) {
      // Only the loopback development server permits Vite's injected styles and
      // local HMR socket. Production and preview enforce the strict policy.
      return html.replace(/(<meta http-equiv="Content-Security-Policy" content=")[^"]*(">)/,
        `$1${contentSecurityPolicy({ development: true })}$2`);
    }
  }],
  server: {
    host: '127.0.0.1', port: 5173, strictPort: true,
    headers: securityHeaders({ development: true })
  },
  preview: {
    host: '127.0.0.1', port: 4173, strictPort: true,
    headers: securityHeaders()
  }
});
