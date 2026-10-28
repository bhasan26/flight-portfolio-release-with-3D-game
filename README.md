# Bilal Hasan's flight portfolio

An aviation-themed portfolio built with Vite, Three.js, and GSAP. It includes experience, projects, stories, skills, a contact form, and a keyboard-controlled flight game.

## Local development

Use Node.js 22.12+ (22.x) or Node.js 24+.

```sh
npm ci
npm run dev
```

The development server binds to `127.0.0.1`. For a production preview:

```sh
npm run build
npm run preview
```

`prebuild` refreshes the public GitHub activity snapshot. If GitHub is unavailable, the build keeps the last successful snapshot. Each API request has a 10-second timeout. Run `npm run github:refresh` to refresh it independently. An optional `GITHUB_TOKEN` increases GitHub's API rate limit; it is used only during the build.

## Validation

```sh
npm test
npm run build
npm audit
```

The Node/jsdom tests cover project and story dialogs, focus restoration, compact navigation, contact success and failure states, blocked storage, game controls, frame-rate-independent physics, GPU resource cleanup, and local asset links. Contact tests mock the delivery service and do not send messages.

Browser checks should include desktop and narrow layouts, every section, a long story, keyboard dialog dismissal, manual flight entry/exit, and the 2D fallback when WebGL is unavailable.

## Content and hosting

- `index.html`: portfolio content, contact fields, and printable resume.
- `main.js`: navigation, content databases, contact delivery, and game interface.
- `ui.js`: dialog, score storage, and steering helpers.
- `style.css`: responsive cockpit theme and print layout.
- `three-scene.js`: lazily loaded 3D scene and flight physics.
- `public/`: resume PDF, images, and search metadata.
- `vercel.json`: production security headers, including HTTPS upgrades.

The contact form uses the existing Formspree endpoint. Failed delivery preserves the current form values and offers an explicit email fallback. Delivery to the recipient must be verified separately with a real submission.
