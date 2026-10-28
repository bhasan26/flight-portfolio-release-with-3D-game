# Bilal Hasan's flight portfolio

An aviation-themed portfolio built with Vite, Three.js, and GSAP. It includes experience, projects, stories, skills, a contact form, and a flight game with keyboard and touch controls.

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

The Node/jsdom tests cover shared content URLs, browser history, clipboard fallback, project and story dialogs, focus restoration, compact navigation, contact success and failure states, blocked storage, game controls, frame-rate-independent physics, GPU resource cleanup, and local asset links. Contact tests mock the delivery service and do not send messages.

Browser checks should include desktop and narrow layouts, every section, a long story, keyboard dialog dismissal, manual flight entry/exit, and the 2D fallback when WebGL is unavailable.

## Content and hosting

- `index.html`: portfolio content, contact fields, and printable resume.
- `main.js`: navigation, content databases, contact delivery, and game interface.
- `ui.js`: dialog, score storage, and steering helpers.
- `navigation.js`: validated section, project, and story URLs with browser history support.
- `interactions.js`: combined touch/keyboard steering, reading estimates, and scroll progress.
- `style.css`: responsive cockpit theme and print layout.
- `three-scene.js`: lazily loaded 3D scene and flight physics.
- `public/`: resume PDF, images, and search metadata.
- `vercel.json`: production security headers, including HTTPS upgrades.

The contact form uses the existing Formspree endpoint. Failed delivery preserves the current form values and offers an explicit email fallback. Delivery to the recipient must be verified separately with a real submission.

Share a section with `#projects`, an individual project with `#project/braillience`, or a story with `#story/google-io-2026`. Project and story dialogs include copy-link controls. Unknown IDs are ignored, and browser Back/Forward navigation restores the requested view.

## Flight and reading controls

- Start **Manual Flight** from the navigation menu. Steer with WASD, arrow keys, or the direction pad shown on touch devices and narrow screens. Hold two directions to fly diagonally.
- **Pause / Resume** (or P) freezes flight position and fuel use. Changing tabs or leaving the window pauses the flight until explicitly resumed. **Restart** resets the flight and fuel while preserving the high score; **Exit Flight** (or Escape) returns to the portfolio. The same controls remain available after running out of fuel.
- Stories show reading estimates at 200 words per minute and a sticky reading progress bar. Progress is based on scroll position; a story that fits entirely in view shows 100%.
- **Pause Animations** is available at the bottom left and inside story dialogs. It stops decorative CSS effects, title scrambling, radar sweeps, and background 3D movement. The choice is saved locally when storage is available, and defaults to paused for reduced-motion users. Explicit gameplay has its own pause control.
