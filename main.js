import { ThreeScene } from './three-scene.js';

// Global instances
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let threeSceneInstance = null;
let activeSection = 'departure';
let lastScrollTop = 0;
let currentAirspeed = 320;
let targetAirspeed = 320;

// Web Audio API Synthesizer state
let audioCtx = null;
let audioMuted = true; // Muted by default to comply with browser user-interaction policies

// Game score telemetry state
let highscore = Number(localStorage.getItem('bilal_flight_highscore')) || 0;

// Manual flight mode needs a keyboard; touch-only devices have no way to steer.
const isTouchOnly = window.matchMedia('(hover: none) and (pointer: coarse)').matches;

// Project Telemetry Database (Spec sheets)
const projectSpecs = {
  braillience: {
    badge: "SPEC-01",
    title: "Braillience AI",
    details: "An engineered stateful AI voice assistant designed to assist visually impaired students. Utilizes a high-fidelity NLP pipeline to ingest long-form transcripts and compile concise summaries. Improved campus accessibility metrics and increased resource utilization by 60% among targeted student demographics.",
    stack: ["OpenAI API", "Python", "NLP Pipeline", "Speech-to-Text", "Vercel"],
    github: "https://github.com/bhasan26",
    buttonText: "VIEW GITHUB PROFILE"
  },
  cricketcoach: {
    badge: "SPEC-02",
    title: "cricketcoach.online",
    details: "A specialized sports analytics portal focused on cricket technique analysis. Uses computer vision and machine learning models to analyze bowling actions and batting styles, providing automated feedback to players.",
    stack: ["Python", "Machine Learning", "Computer Vision", "Web Deployment"],
    github: "https://github.com/bhasan26/cricket-shadow-coach"
  },
  ersimulator: {
    badge: "SPEC-03",
    title: "Emergency Room Simulator",
    details: "A backend simulation system modeling real-time patient care priority and hospital workflow. Prioritizes incoming patient care using custom queue structures and tracks real-time performance and bottleneck metrics.",
    stack: ["C++", "Python", "SQL"],
    github: "https://github.com/bhasan26",
    buttonText: "VIEW GITHUB PROFILE"
  },
  autext: {
    badge: "SPEC-04",
    title: "Autext Audiobook Platform",
    details: "Engineered a responsive full-stack audiobook organizer and reader. Features custom narration configurations powered by the Web Speech API and Node.js/Express, enabling users to curate custom audiobook catalog shelves.",
    stack: ["JavaScript", "Node.js", "Express", "Web Speech API", "CSS Grid"],
    github: "https://github.com/bhasan26/Text-to-audio"
  },
  whitworthian: {
    badge: "SPEC-05",
    title: "NWC Basketball Feature",
    details: `<div class="article-preview-container"><img class="article-preview-image" src="/whitworthian-basketball.jpg" alt="Whitworth Basketball" /><blockquote class="article-quote">"The Northwest Conference (NWC) tournament is just around the corner, and the Whitworth men’s basketball team is focused and has one goal: to bring the trophy home. The Whitworth Pirates are currently ranked first heading into the tournament after winning the regular season NWC title..."</blockquote><p class="article-meta-info">Published in <strong>The Whitworthian</strong> &bull; March 2026</p></div>`,
    stack: ["Journalism", "Sports Writing", "Editorial"],
    github: "https://thewhitworthian.news/20482/sports/eyes-on-the-prize-pirates-eye-the-nwc-title-after-regular-season-success/",
    buttonText: "READ FULL ARTICLE"
  },
  gdg: {
    badge: "SPEC-06",
    title: "GDG on Campus",
    details: `<div class="article-preview-container"><blockquote class="article-quote">"Selected to lead the student developer community on campus, organizing technical workshops, speaker events, and collaborative hackathons. Facilitate hands-on learning experiences to help peers build impactful software, focusing on emerging tools like the Gemini API, Cloud architectures, and AI voice agents."</blockquote><p class="article-meta-info">Founder & Organizer &bull; Whitworth University</p></div>`,
    stack: ["Community", "Google Cloud", "Gemini API", "AI Voice Agents"],
    github: "https://gdg.community.dev/gdg-on-campus-whitworth-university/",
    buttonText: "VISIT COMMUNITY HUB"
  }
};

// Stories Database (Flight Journal / Blog)
// To publish a new story: add an entry here keyed by a unique slug, then add a
// matching .story-card block in index.html (inside #stories .stories-grid) with
// data-story="<slug>" pointing at this key. Drop a cover image in public/stories/
// and reference it via the `cover` field, or omit it to use the placeholder icon.
const storySpecs = {
  "gdg-year-one": {
    date: "APR 2026",
    title: "One Year Running GDG on Campus",
    icon: "●",
    cover: "/stories/gdg-certificate.png",
    body: `<p>A year ago I had a Slack channel and an idea. Now GDG on Campus runs regular workshops, a hackathon, and a speaker series built around the Gemini API and cloud architecture.</p><p>The biggest lesson: community momentum comes from consistency, not big launches. Showing up every two weeks beat any single flashy event.</p>`,
    tags: ["Community", "Leadership"]
  },
  "google-io-2026": {
    date: "MAY 2026",
    title: "On the Ground at Google I/O 2026",
    icon: "✈",
    cover: "/stories/io-group.jpg",
    body: `<p>Flew out to Shoreline Amphitheatre with the rest of the GDG on Campus crew for Google I/O 2026 — a full day of keynotes, sessions, and wandering the developer lounge between talks.</p>
      <div class="story-photo-float">
        <div class="float-photo float-1"><img src="/stories/io-group.jpg" alt="GDG on Campus group at Google I/O 2026" /></div>
        <div class="float-photo float-2"><img src="/stories/io-solo.jpg" alt="Standing under the Google I/O sign" /></div>
        <div class="float-photo float-3"><img src="/stories/io-lounge.jpg" alt="The developer lounge at Google I/O" /></div>
        <div class="float-photo float-4"><img src="/stories/io-bike.jpg" alt="Riding a Google campus bike" /></div>
      </div>
      <p>Highlight of the trip was rolling around the Google campus on one of their classic four-color bikes between sessions — propeller hat included. Good reminder that the best conferences leave room for the in-between moments, not just the stage time.</p>

      <h4 class="text-cyan">🚀 The Core Theme: The "Agentic" Shift</h4>
      <p>Sundar Pichai noted that Google is entering a period of "hyper-progress." The major takeaway is the transition from static chat tools to autonomous background agents.</p>

      <h4 class="text-cyan">🧠 Next-Gen Models</h4>
      <ul>
        <li><strong>Gemini 3.5 Flash:</strong> Generally available at launch, this model is built specifically for long-horizon agentic workflows (rapid planning, codebase maintenance, and data auditing). It rivaled flagship models on coding benchmarks like Terminal-Bench 2.1 but at a fraction of the speed and cost.</li>
        <li><strong>Gemini Omni:</strong> A new multimodal frontier model capable of handling any input to create any output, deeply integrated with natural conversational editing.</li>
        <li><strong>Gemini 3.5 Pro:</strong> Teased as coming later this summer.</li>
      </ul>

      <h4 class="text-cyan">🔍 The Biggest Search Redesign in 25 Years</h4>
      <p>Google Search received a massive overhaul aimed at keeping you within the Google ecosystem rather than navigating to external URLs:</p>
      <ul>
        <li><strong>Intelligent AI Search Box:</strong> You can now drop images, videos, full files, and even live Chrome tabs directly alongside a natural language prompt.</li>
        <li><strong>Conversational AI Overviews:</strong> Turns standard summaries into back-and-forth chatbot exchanges natively inside the search results.</li>
        <li><strong>Search Agents (Gemini Spark):</strong> A massive feature for AI Pro and Ultra subscribers. These background agents track complex web workflows — like monitoring flat listings or sneaker drops — and can even make background phone calls to businesses on your behalf.</li>
      </ul>

      <h4 class="text-cyan">💻 Major Developer Announcements</h4>
      <p>If your blog caters to devs, this was arguably the most practical section of the keynote:</p>
      <ul>
        <li><strong>Google Antigravity 2.0:</strong> Google's agent-first development platform and new CLI allow devs to orchestrate and spin up sandboxed "subagents" to write, migrate, and optimize full codebases safely.</li>
        <li><strong>Vibe Coding in AI Studio:</strong> You can now natively vibe code Android apps inside Google AI Studio with native Kotlin support, one-click deployments to Cloud Run, and full export capabilities to Antigravity.</li>
        <li><strong>Android Migration Agent:</strong> A killer tool previewed for Android Studio that can take code written in iOS, React Native, or web frameworks and automatically migrate it to native Kotlin in hours instead of weeks.</li>
        <li><strong>WebMCP:</strong> A newly proposed open web standard that exposes structured tools (like JavaScript functions and HTML forms) so browser-based AI agents can execute complex tasks precisely.</li>
      </ul>

      <h4 class="text-cyan">🎛️ Hardware & Product Ecosystem Highlights</h4>
      <ul>
        <li><strong>Android XR & Smart Glasses:</strong> Google teased the consumer arrival of Android XR headsets coming this fall, alongside a preview of Google Audio Glasses (intelligent eyewear for real-time text, navigation, and capturing media without pulling out a phone).</li>
        <li><strong>Universal Cart:</strong> The foundation for agentic commerce — a unified smart shopping cart that scours availability, live prices, and handles multi-site checkout automatically.</li>
        <li><strong>Google Flow & Flow Music:</strong> Significant upgrades to their creative collaborator toolkits, giving creators full AI orchestration capabilities.</li>
      </ul>`,
    tags: ["Google I/O", "Travel", "Gemini", "Agentic AI"]
  },
  "whitworth-hof": {
    date: "JUL 2026",
    title: "Summer Research: Building the Whitworth Heritage Gallery",
    icon: "◈",
    cover: "/stories/whitworth-hof.png",
    body: `<p>Spent this summer on a research appointment at Whitworth University building out the digital home for the Whitworth Heritage Gallery — the university's athletics Hall of Fame, honoring the 100+ athletes, coaches, and staff inducted since 1990.</p>
      <p>The project meant digitizing decades of physical inductee records — yearbook photos, newspaper clippings, plaque scans — into a searchable, browsable gallery, and building a clean front end for it: a home page with recent inductees, a full Hall of Fame directory, and coach/about pages.</p>
      <p>Biggest challenge wasn't the code, it was the archive work: normalizing inconsistent decades-old source material (scanned clippings, yearbook portraits, printed certificates) into a coherent, presentable format without losing the historical character of the originals.</p>
      <p>Live at <a href="https://whitworthathleticshof.whitworth.edu/" target="_blank" rel="noopener noreferrer" class="text-cyan">whitworthathleticshof.whitworth.edu</a>.</p>`,
    tags: ["Research", "Web Dev", "Whitworth"]
  }
};

// 1. Initialize systems when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Run each system independently — one throwing (e.g. a hidden canvas on mobile)
  // must never prevent the rest of the page's interactivity from initializing.
  const systems = [
    setupPreloader, setupClock, setupRadar, setupFidsAnimations,
    setupProjectModals, setupStoryModals, setupContactForm,
    setupAudioSynth, setupHighScoreDisplay, setupStaticActions
  ];
  systems.forEach(fn => {
    try {
      fn();
    } catch (err) {
      console.error(`Init failed for ${fn.name}:`, err);
    }
  });
});

// 2. Preloader Animation Sequence
function setupPreloader() {
  const preloader = document.getElementById('preloader');
  const statusText = document.getElementById('preloader-status');
  
  let progress = 0;
  const interval = setInterval(() => {
    progress += Math.floor(Math.random() * 15) + 5;
    if (progress >= 100) {
      progress = 100;
      clearInterval(interval);
      initializeThreeScene();
    }
    statusText.textContent = `Pre-flight checks: ${progress}%...`;
  }, 80);
}

function initializeThreeScene() {
  const statusText = document.getElementById('preloader-status');
  statusText.textContent = "Loading 3D Flight Engines...";
  
  setTimeout(() => {
    try {
      threeSceneInstance = new ThreeScene('canvas-container', (message, pct) => {
        statusText.textContent = `${message} (${pct}%)`;
      });
      
      // Fully load
      setTimeout(() => {
        const preloader = document.getElementById('preloader');
        preloader.style.opacity = 0;
        document.body.classList.remove('loading-state');
        
        setTimeout(() => {
          preloader.style.display = 'none';
          flipText(document.getElementById('fids-main-title'), 'BILAL HASAN');
        }, 500);
        
        setupScrollControls();
        setupManualFlightTriggers();
      }, 600);
      
    } catch (e) {
      console.error("Three.js initialization failure:", e);
      statusText.textContent = "Error loading WebGL. Starting in 2D mode...";
      setTimeout(() => {
        const preloader = document.getElementById('preloader');
        preloader.style.opacity = 0;
        document.body.classList.remove('loading-state');
        setTimeout(() => { preloader.style.display = 'none'; }, 500);

        // The page still has to be navigable without WebGL — nav buttons, the
        // mobile menu and the HUD instruments all live in setupScrollControls.
        setupScrollControls();

        // No 3D scene means no manual flight mode; hide the override switch
        // instead of leaving a button that silently does nothing.
        const gameBtn = document.getElementById('game-override-btn');
        if (gameBtn) gameBtn.style.display = 'none';
      }, 1000);
    }
  }, 200);
}

// 2b. Listeners that used to live in inline `onclick` attributes. The deployed
// CSP is `script-src 'self'` (no 'unsafe-inline'), which blocks inline handlers
// outright, so they have to be bound from this module instead.
function setupStaticActions() {
  const takeoffCta = document.getElementById('takeoff-cta');
  if (takeoffCta) {
    takeoffCta.addEventListener('click', () => {
      playSynthAudio('click');
      document.getElementById('experience')?.scrollIntoView({ behavior: 'smooth' });
    });
  }

  // Link previews sit inside clickable cards — opening the external link must
  // not also pop the card's modal.
  document.querySelectorAll('.link-preview-box').forEach(link => {
    link.addEventListener('click', (e) => e.stopPropagation());
  });

  // Escape closes whichever modal is open.
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
  });
}

// 3. Autopilot Navigation & Scroll Sync
function setupScrollControls() {
  const scrollContainer = document.getElementById('scroll-main');
  const navButtons = document.querySelectorAll('.nav-btn');
  const altitudeVal = document.getElementById('hud-altitude');
  const altitudeBar = document.getElementById('hud-altitude-bar');
  const speedVal = document.getElementById('hud-speed');
  const speedBar = document.getElementById('hud-speed-bar');

  const maxAltitude = 27000;

  // Mobile hamburger nav toggle
  const mobileNavToggle = document.getElementById('mobile-nav-toggle');
  const hudNav = document.querySelector('.hud-nav');
  if (mobileNavToggle && hudNav) {
    mobileNavToggle.addEventListener('click', () => {
      const isOpen = hudNav.classList.toggle('mobile-open');
      mobileNavToggle.setAttribute('aria-expanded', String(isOpen));
    });
  }

  // Bind Nav click triggers
  navButtons.forEach(btn => {
    // Exclude manual flight button from standard nav scrolling
    if (btn.id === 'game-override-btn') return;

    btn.addEventListener('click', (e) => {
      // Ignore if manual flight mode is active
      if (threeSceneInstance && threeSceneInstance.gameActive) return;

      playSynthAudio('click');

      const targetSectionId = btn.getAttribute('data-section');
      const targetSection = document.getElementById(targetSectionId);

      if (targetSection) {
        targetSection.scrollIntoView({ behavior: 'smooth' });
      }

      if (hudNav && mobileNavToggle) {
        hudNav.classList.remove('mobile-open');
        mobileNavToggle.setAttribute('aria-expanded', 'false');
      }
    });

    btn.addEventListener('mouseenter', () => {
      if (threeSceneInstance && threeSceneInstance.gameActive) return;
      playSynthAudio('hover');
    });
  });
  
  // Track scroll metrics
  scrollContainer.addEventListener('scroll', () => {
    if (threeSceneInstance && threeSceneInstance.gameActive) return; // Freeze scroll inputs in game mode
    
    const scrollTop = scrollContainer.scrollTop;
    const scrollHeight = scrollContainer.scrollHeight - scrollContainer.clientHeight;
    
    let percentage = 0;
    if (scrollHeight > 0) {
      percentage = scrollTop / scrollHeight;
    }
    
    // 1. Pass scroll coordinates to ThreeJS
    if (threeSceneInstance) {
      threeSceneInstance.updateScroll(percentage);
    }
    
    // 2. HUD Instruments updates
    const currentAltitude = Math.round(percentage * maxAltitude);
    altitudeVal.textContent = currentAltitude.toLocaleString();
    altitudeBar.style.width = `${percentage * 100}%`;
    
    const scrollDelta = Math.abs(scrollTop - lastScrollTop);
    lastScrollTop = scrollTop;
    
    targetAirspeed = 320 + Math.min(scrollDelta * 6, 260);
    
    // 3. Highlight current active section HUD button
    const sections = ['departure', 'experience', 'projects', 'stories', 'controls', 'arrival'];
    let currentActive = 'departure';
    
    const viewportHeight = window.innerHeight;
    
    sections.forEach(secId => {
      const el = document.getElementById(secId);
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.top <= viewportHeight / 2 && rect.bottom >= viewportHeight / 2) {
          currentActive = secId;
        }
      }
    });
    
    if (currentActive !== activeSection) {
      activeSection = currentActive;
      
      // Update NAV deck highlighting
      navButtons.forEach(btn => {
        if (btn.id === 'game-override-btn') return;
        if (btn.getAttribute('data-section') === activeSection) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
      
      const sectionTitle = document.querySelector(`#${activeSection} .section-title`);
      if (sectionTitle) {
        // Read from the cached original, never from textContent: a re-entry
        // while a previous flip is mid-scramble would otherwise latch the
        // scrambled characters in as the title permanently.
        flipText(sectionTitle, sectionTitle.dataset.flipText || sectionTitle.textContent);
      }
      
      const statusIndicator = document.getElementById('flight-status-indicator');
      if (activeSection === 'departure') {
        statusIndicator.textContent = "BH-2027 ON RUNWAY";
        statusIndicator.className = "brand-title fids-font text-cyan glow-text";
      } else if (activeSection === 'experience') {
        statusIndicator.textContent = "CRUISING ALTITUDE";
        statusIndicator.className = "brand-title fids-font text-cyan glow-text";
      } else if (activeSection === 'projects') {
        statusIndicator.textContent = "HANGAR GATES OPEN";
        statusIndicator.className = "brand-title fids-font text-amber glow-amber";
      } else if (activeSection === 'stories') {
        statusIndicator.textContent = "FLIGHT JOURNAL OPEN";
        statusIndicator.className = "brand-title fids-font text-cyan glow-text";
      } else if (activeSection === 'controls') {
        statusIndicator.textContent = "AUTOPILOT COCKPIT";
        statusIndicator.className = "brand-title fids-font text-cyan glow-text";
      } else if (activeSection === 'arrival') {
        statusIndicator.textContent = "LANDING GATES ENGAGED";
        statusIndicator.className = "brand-title fids-font text-green glow-green";
      }
    }
  });
  
  // Speedometer frame sweeps
  setInterval(() => {
    if (threeSceneInstance && threeSceneInstance.gameActive) {
      // Set to game throttle speed (480 KTS cruise)
      targetAirspeed = 485 + Math.sin(Date.now() * 0.005) * 5;
    }
    
    currentAirspeed += (targetAirspeed - currentAirspeed) * 0.1;
    if (targetAirspeed > 320 && (!threeSceneInstance || !threeSceneInstance.gameActive)) {
      targetAirspeed -= 2;
    }
    speedVal.textContent = Math.round(currentAirspeed);
    
    const speedPct = Math.min((currentAirspeed / 600) * 100, 100);
    speedBar.style.width = `${speedPct}%`;
  }, 30);
}

// 4. Cockpit Clock System (UTC)
function setupClock() {
  const clockEl = document.getElementById('hud-clock-time');
  
  function updateTime() {
    const now = new Date();
    const pacificTimeStr = now.toLocaleTimeString("en-US", { timeZone: "America/Los_Angeles", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    clockEl.textContent = `${pacificTimeStr} PT`;
  }
  
  updateTime();
  setInterval(updateTime, 1000);
}

// 5. High-fidelity Flight Radar canvas mini-map
function setupRadar() {
  const canvas = document.getElementById('radar-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const coordinatesEl = document.getElementById('radar-coordinates');
  
  function resizeRadar() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
  }
  
  resizeRadar();
  window.addEventListener('resize', resizeRadar);
  
  const waypoints = [
    { label: "GEG", x: 0.2, y: 0.8 },
    { label: "WHT", x: 0.35, y: 0.55 },
    { label: "KSR", x: 0.5, y: 0.4 },
    { label: "HNG", x: 0.65, y: 0.3 },
    { label: "SWE", x: 0.85, y: 0.15 }
  ];
  
  let sweepAngle = 0;
  
  function drawRadar() {
    // Radar's parent is hidden (display:none) on tablets/phones, which collapses
    // the canvas to 0x0 and makes maxRadius negative — skip drawing until it's visible again.
    if (canvas.width <= 0 || canvas.height <= 0) {
      requestAnimationFrame(drawRadar);
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const maxRadius = Math.min(centerX, centerY) - 10;

    // Concentric sweep rings
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let r = 1; r <= 3; r++) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, (maxRadius / 3) * r, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    // Axes cross
    ctx.beginPath();
    ctx.moveTo(centerX - maxRadius, centerY);
    ctx.lineTo(centerX + maxRadius, centerY);
    ctx.moveTo(centerX, centerY - maxRadius);
    ctx.lineTo(centerX, centerY + maxRadius);
    ctx.stroke();
    
    // Draw flight routes
    ctx.strokeStyle = 'rgba(255, 165, 0, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    waypoints.forEach((wp, idx) => {
      const px = wp.x * canvas.width;
      const py = wp.y * canvas.height;
      if (idx === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Beacons
    waypoints.forEach(wp => {
      const px = wp.x * canvas.width;
      const py = wp.y * canvas.height;
      ctx.fillStyle = 'rgba(0, 255, 255, 0.15)';
      ctx.beginPath();
      ctx.arc(px, py, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#00ffff';
      ctx.beginPath();
      ctx.arc(px, py, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = '8px JetBrains Mono';
      ctx.fillText(wp.label, px + 6, py - 4);
    });
    
    // Calculate aircraft radar coordinate position
    let planeX = waypoints[0].x * canvas.width;
    let planeY = waypoints[0].y * canvas.height;
    let pct = 0;
    
    if (threeSceneInstance && threeSceneInstance.gameActive) {
      // In game mode: blip pulses randomly in the center representing free flight
      planeX = centerX + Math.sin(Date.now() * 0.003) * 15;
      planeY = centerY + Math.cos(Date.now() * 0.002) * 10;
      
      if (coordinatesEl && Math.random() > 0.96) {
        coordinatesEl.textContent = `FREE STEER ACTIVE`;
      }
    } else {
      const scrollContainer = document.getElementById('scroll-main');
      if (scrollContainer) {
        const totalScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;
        if (totalScroll > 0) pct = scrollContainer.scrollTop / totalScroll;
      }
      
      const segmentCount = waypoints.length - 1;
      const currentSegIdx = Math.min(Math.floor(pct * segmentCount), segmentCount - 1);
      const segPct = (pct * segmentCount) - currentSegIdx;
      
      const wpStart = waypoints[currentSegIdx];
      const wpEnd = waypoints[currentSegIdx + 1];
      
      planeX = wpStart.x * canvas.width + (wpEnd.x - wpStart.x) * segPct;
      planeY = wpStart.y * canvas.height + (wpEnd.y - wpStart.y) * segPct;
      
      if (coordinatesEl && Math.random() > 0.95) {
        const lat = (47.6588 + (pct * 0.1) + (Math.random() - 0.5) * 0.005).toFixed(4);
        const lng = (117.4260 - (pct * 0.2) + (Math.random() - 0.5) * 0.005).toFixed(4);
        coordinatesEl.textContent = `${lat}° N, ${lng}° W`;
      }
    }
    
    // Draw plane radar blip
    ctx.strokeStyle = '#22c55e';
    ctx.fillStyle = 'rgba(34, 197, 94, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(planeX, planeY, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(planeX, planeY, 3, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw radar sweep line
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(sweepAngle);
    
    const sweepGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, maxRadius);
    sweepGrad.addColorStop(0, 'rgba(0, 255, 255, 0.15)');
    sweepGrad.addColorStop(1, 'rgba(0, 255, 255, 0)');
    
    ctx.fillStyle = sweepGrad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, maxRadius, -Math.PI / 12, Math.PI / 12);
    ctx.lineTo(0, 0);
    ctx.fill();
    ctx.restore();
    
    if (!prefersReducedMotion) sweepAngle += 0.015;

    requestAnimationFrame(drawRadar);
  }
  
  drawRadar();
}

// 6. FIDS Scrambled Flip board
function setupFidsAnimations() {
  if (prefersReducedMotion) return; // Titles render as plain text, no scramble effect

  const targets = document.querySelectorAll('.animate-on-scroll .role-title, .animate-on-scroll .company-name');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        if (!el.dataset.animated) {
          el.dataset.animated = "true";
          flipText(el, el.textContent);
        }
      }
    });
  }, { threshold: 0.1 });
  
  targets.forEach(t => observer.observe(t));
}

const activeFlips = new WeakMap();

function flipText(element, finalString) {
  if (!element) return;

  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890/_➔[] ";
  const originalText = finalString.trim().toUpperCase();

  // Remember the real text and cancel any flip still running on this element,
  // so restarts can't compound into garbage.
  element.dataset.flipText = originalText;
  clearInterval(activeFlips.get(element));

  element.textContent = "";

  let currentString = Array(originalText.length).fill(' ');
  let iteration = 0;
  
  const interval = setInterval(() => {
    element.textContent = currentString.join('');
    
    for (let i = 0; i < originalText.length; i++) {
      if (originalText[i] === ' ') {
        currentString[i] = ' ';
        continue;
      }
      
      if (iteration > i * 1.5 + 5) {
        currentString[i] = originalText[i];
      } else {
        currentString[i] = chars[Math.floor(Math.random() * chars.length)];
      }
    }
    
    const fullyComplete = currentString.join('') === originalText;
    if (fullyComplete || iteration > originalText.length * 3 + 10) {
      element.textContent = originalText;
      clearInterval(interval);
    }
    
    iteration++;
  }, 25);

  activeFlips.set(element, interval);
}

// 7. Hangar Modals
function setupProjectModals() {
  const blueprintCards = document.querySelectorAll('.project-blueprint-card');
  const modal = document.getElementById('project-modal');
  const closeModalBtn = document.getElementById('close-modal-btn');
  
  const modalBadge = document.getElementById('modal-project-badge');
  const modalTitle = document.getElementById('modal-project-title');
  const modalDetails = document.getElementById('modal-project-details');
  const modalStack = document.getElementById('modal-project-stack');
  const modalGithub = document.getElementById('modal-project-github');
  
  blueprintCards.forEach(card => {
    card.addEventListener('click', () => {
      playSynthAudio('click');
      const projId = card.getAttribute('data-project');
      const specs = projectSpecs[projId];
      
      if (specs) {
        modalBadge.textContent = specs.badge;
        modalTitle.textContent = specs.title.toUpperCase();
        modalDetails.innerHTML = specs.details;
        
        modalStack.innerHTML = "";
        specs.stack.forEach(tech => {
          const b = document.createElement('span');
          b.className = "badge badge-outline";
          b.textContent = tech;
          modalStack.appendChild(b);
        });
        
        modalGithub.href = specs.github;
        const buttonSpan = modalGithub.querySelector('span');
        if (buttonSpan) {
          buttonSpan.textContent = specs.buttonText || "GITHUB REPOSITORY";
        }
        
        modal.classList.add('active');
        flipText(modalTitle, specs.title);
      }
    });
    
    card.addEventListener('mouseenter', () => {
      playSynthAudio('hover');
    });
  });
  
  closeModalBtn.addEventListener('click', () => {
    playSynthAudio('click');
    modal.classList.remove('active');
  });
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      playSynthAudio('click');
      modal.classList.remove('active');
    }
  });
}

// 7b. Flight Journal Modals (Stories / Blog)
function setupStoryModals() {
  const storyCards = document.querySelectorAll('.story-card');
  const modal = document.getElementById('story-modal');
  const closeModalBtn = document.getElementById('close-story-modal-btn');

  const modalDate = document.getElementById('modal-story-date');
  const modalTitle = document.getElementById('modal-story-title');
  const modalBody = document.getElementById('modal-story-body');
  const modalTags = document.getElementById('modal-story-tags');
  const modalCover = document.getElementById('modal-story-cover');
  const modalIcon = document.getElementById('modal-story-icon');

  storyCards.forEach(card => {
    card.addEventListener('click', () => {
      playSynthAudio('click');
      const storyId = card.getAttribute('data-story');
      const story = storySpecs[storyId];

      if (story) {
        modalDate.textContent = story.date;
        modalTitle.textContent = story.title.toUpperCase();
        modalBody.innerHTML = story.body;

        modalTags.innerHTML = "";
        story.tags.forEach(tag => {
          const b = document.createElement('span');
          b.textContent = tag;
          modalTags.appendChild(b);
        });

        if (story.cover) {
          modalCover.style.backgroundImage = `url('${story.cover}')`;
          modalIcon.style.display = 'none';
        } else {
          modalCover.style.backgroundImage = 'none';
          modalIcon.style.display = 'block';
          modalIcon.textContent = story.icon || '✈';
        }

        modal.classList.add('active');
        flipText(modalTitle, story.title.toUpperCase());
      }
    });

    card.addEventListener('mouseenter', () => {
      playSynthAudio('hover');
    });
  });

  closeModalBtn.addEventListener('click', () => {
    playSynthAudio('click');
    modal.classList.remove('active');
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      playSynthAudio('click');
      modal.classList.remove('active');
    }
  });
}

// 8. Customs Form submission with mock Formspree routing API
function setupContactForm() {
  const form = document.getElementById('customs-contact-form');
  if (!form) return;
  
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    playSynthAudio('click');
    
    const passengerName = document.getElementById('passenger-name').value;
    const passengerEmail = document.getElementById('passenger-email').value;
    const cargoManifest = document.getElementById('cargo-manifest').value;
    
    const submitBtn = form.querySelector('.form-submit-btn');
    const originalText = submitBtn.innerHTML;
    
    submitBtn.disabled = true;
    submitBtn.innerHTML = "<span>TRANSMITTING TELEMETRY...</span>";
    
    const formspreeFormId = "xovqdbyq";

    fetch(`https://formspree.io/f/${formspreeFormId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        name: passengerName,
        email: passengerEmail,
        message: cargoManifest
      })
    })
    .then((res) => {
      if (!res.ok) throw new Error(`Formspree responded with ${res.status}`);
      submitBtn.className = "form-submit-btn bg-cyan text-dark font-extrabold";
      submitBtn.innerHTML = "<span>TRANSMISSION SUCCESSFUL ✓</span>";
      
      const stampEl = document.querySelector('.passport-stamp');
      stampEl?.classList.add('animate-pulse');
      playSynthAudio('chime');
      
      alert(`Customs Declaration Transmitted!\nPassenger: ${passengerName}\nCoordinates logged successfully to GEG.`);
      form.reset();
      
      setTimeout(() => {
        submitBtn.disabled = false;
        submitBtn.className = "form-submit-btn bg-green text-dark font-extrabold";
        submitBtn.innerHTML = originalText;
        stampEl?.classList.remove('animate-pulse');
      }, 3000);
    })
    .catch((err) => {
      // The message did NOT get through — never report success here, or a real
      // visitor's note is dropped while they believe it was sent. Fall back to
      // their own mail client with the message pre-filled.
      console.error("Contact form transmission failed:", err);

      submitBtn.className = "form-submit-btn bg-amber text-dark font-extrabold";
      submitBtn.innerHTML = "<span>TRANSMISSION FAILED ✕</span>";

      const mailto = `mailto:khanjames160@gmail.com`
        + `?subject=${encodeURIComponent(`Portfolio contact from ${passengerName}`)}`
        + `&body=${encodeURIComponent(`${cargoManifest}\n\nReply to: ${passengerEmail}`)}`;

      alert(
        `Transmission failed — your message was not delivered.\n\n` +
        `Opening your mail client so it isn't lost. You can also reach me directly at khanjames160@gmail.com.`
      );
      window.location.href = mailto;

      setTimeout(() => {
        submitBtn.disabled = false;
        submitBtn.className = "form-submit-btn bg-green text-dark font-extrabold";
        submitBtn.innerHTML = originalText;
      }, 3000);
    });
  });
}

// ==========================================================================
// ADVANCED INTERACTIVE FEATURE CODES: AUDIO SYNTH & FLIGHT GAME SYSTEM
// ==========================================================================

// 9. Procedural Web Audio API sound synthesizer
function setupAudioSynth() {
  const soundToggleBtn = document.getElementById('sound-toggle-btn');
  if (!soundToggleBtn) return;
  
  soundToggleBtn.addEventListener('click', () => {
    // Initialize AudioContext on first user interaction
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    // Toggle audio
    audioMuted = !audioMuted;
    
    if (audioMuted) {
      soundToggleBtn.classList.remove('active');
      soundToggleBtn.className = "sound-btn text-muted";
      soundToggleBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mute-icon">
          <path d="M11 5 6 9H2v6h4l5 4V5z"/>
          <line x1="23" y1="9" x2="17" y2="15"/>
          <line x1="17" y1="9" x2="23" y2="15"/>
        </svg>
      `;
    } else {
      soundToggleBtn.classList.add('active');
      soundToggleBtn.className = "sound-btn active text-amber";
      soundToggleBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mute-icon">
          <path d="M11 5 6 9H2v6h4l5 4V5z"/>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
        </svg>
      `;
      // Resume context if suspended
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      // Play indicator sound
      playSynthAudio('chime');
    }
  });
}

function playSynthAudio(type) {
  if (audioMuted || !audioCtx) return;
  
  // Resume context check
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  
  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  
  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  
  const now = audioCtx.currentTime;
  
  if (type === 'hover') {
    // High clicky diagnostic indicator tick
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(2000, now + 0.05);
    
    gainNode.gain.setValueAtTime(0.015, now);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
    
    osc.start(now);
    osc.stop(now + 0.05);
  } 
  else if (type === 'click') {
    // Decisive medium square sweep
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.1);
    
    gainNode.gain.setValueAtTime(0.04, now);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
    
    osc.start(now);
    osc.stop(now + 0.1);
  } 
  else if (type === 'chime') {
    // Beautiful dual chime (Success signal)
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.setValueAtTime(880.00, now + 0.12); // A5
    gainNode.gain.setValueAtTime(0.05, now);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1174.66, now + 0.12); // D6
    gain2.gain.setValueAtTime(0.03, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
    
    osc.start(now);
    osc2.start(now + 0.12);
    
    osc.stop(now + 0.5);
    osc2.stop(now + 0.6);
  }
}

// 10. Manual steer flight game mode triggers & hooks
function setupManualFlightTriggers() {
  const gameBtn = document.getElementById('game-override-btn');
  const gameHud = document.getElementById('game-hud');
  const autopilotLed = document.getElementById('autopilot-led');
  const autopilotText = document.getElementById('autopilot-status-text');
  
  if (!gameBtn || !threeSceneInstance) return;

  // Manual flight is WASD/arrow-key steering only. On a touch-only device it
  // would lock page scrolling for ~30s with no way to fly, so don't offer it.
  if (isTouchOnly) {
    gameBtn.style.display = 'none';
    return;
  }

  // Highscore display
  setupHighScoreDisplay();

  let gameOverHandled = false;

  gameBtn.addEventListener('click', () => {
    // Initialize Web Audio Context if needed
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    const active = !threeSceneInstance.gameActive;
    gameOverHandled = false;

    playSynthAudio('click');
    threeSceneInstance.toggleGameMode(active);
    
    if (active) {
      // Game activated
      gameBtn.classList.add('active');
      gameHud.classList.add('active');
      
      // Update Autopilot Instrument Led to warning amber override state
      autopilotLed.className = "indicator-led bg-amber animate-pulse";
      autopilotText.textContent = "MAN OVERRIDE";
      autopilotText.className = "status-text glow-amber text-amber";
      
      // Disengage other nav scroll controls
      document.querySelectorAll('.hud-nav .nav-btn').forEach(btn => {
        if (btn.id !== 'game-override-btn') {
          btn.style.opacity = '0.3';
          btn.style.pointerEvents = 'none';
        }
      });
      
      // Wire keyboard listeners
      window.addEventListener('keydown', handleGameKeyDown);
      window.addEventListener('keyup', handleGameKeyUp);
      
      // Hook collides chime oscillator beep sound
      threeSceneInstance.onCollisionRing = () => {
        playSynthAudio('chime');
      };
      
      // Hook game score updates to telemetry panel
      threeSceneInstance.onGameUpdate = (stats) => {
        const scoreEl = document.getElementById('game-score');
        const energyEl = document.getElementById('game-energy');
        
        scoreEl.textContent = stats.score;
        energyEl.textContent = `${Math.round(stats.energy)}%`;
        
        if (stats.energy > 50) {
          energyEl.className = "stat-value text-green glow-green";
        } else if (stats.energy > 20) {
          energyEl.className = "stat-value text-amber glow-amber";
        } else {
          energyEl.className = "stat-value text-red animate-pulse";
        }
        
        // High score updates
        if (stats.score > highscore) {
          highscore = stats.score;
          localStorage.setItem('bilal_flight_highscore', highscore);
          document.getElementById('game-highscore').textContent = highscore;
        }
        
        // Fuel energy exhausted game over trigger. The scene keeps emitting
        // gameOver every frame until it is torn down, so latch it.
        if (stats.gameOver && !gameOverHandled) {
          gameOverHandled = true;
          playSynthAudio('click');
          alert(`Telemetry warning: Cockpit fuel critical!\nScore achieved: ${stats.score} points.`);

          // Disable game
          gameBtn.click();
        }
      };
      
    } else {
      // Game deactivated
      gameBtn.classList.remove('active');
      gameHud.classList.remove('active');
      
      autopilotLed.className = "indicator-led status-green blink";
      autopilotText.textContent = "SYS ACTIVE";
      autopilotText.className = "status-text glow-text text-green";
      
      document.querySelectorAll('.hud-nav .nav-btn').forEach(btn => {
        btn.style.opacity = '';
        btn.style.pointerEvents = '';
      });
      
      // Remove listeners
      window.removeEventListener('keydown', handleGameKeyDown);
      window.removeEventListener('keyup', handleGameKeyUp);
      
      // Reset keyboard inputs
      threeSceneInstance.keyboardInput = { up: false, down: false, left: false, right: false };
    }
  });
}

function handleGameKeyDown(e) {
  if (!threeSceneInstance) return;
  const key = e.key.toLowerCase();
  
  if (key === 'w' || e.key === 'ArrowUp') threeSceneInstance.keyboardInput.up = true;
  if (key === 's' || e.key === 'ArrowDown') threeSceneInstance.keyboardInput.down = true;
  if (key === 'a' || e.key === 'ArrowLeft') threeSceneInstance.keyboardInput.left = true;
  if (key === 'd' || e.key === 'ArrowRight') threeSceneInstance.keyboardInput.right = true;
}

function handleGameKeyUp(e) {
  if (!threeSceneInstance) return;
  const key = e.key.toLowerCase();
  
  if (key === 'w' || e.key === 'ArrowUp') threeSceneInstance.keyboardInput.up = false;
  if (key === 's' || e.key === 'ArrowDown') threeSceneInstance.keyboardInput.down = false;
  if (key === 'a' || e.key === 'ArrowLeft') threeSceneInstance.keyboardInput.left = false;
  if (key === 'd' || e.key === 'ArrowRight') threeSceneInstance.keyboardInput.right = false;
}

function setupHighScoreDisplay() {
  const highscoreEl = document.getElementById('game-highscore');
  if (highscoreEl) {
    highscoreEl.textContent = highscore;
  }
}
