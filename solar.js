/**
 * Solar position for the departure airport (KGEG, Spokane).
 *
 * Pure arithmetic — no API, no network, no key, nothing to rate-limit or go
 * stale. Given a Date it returns where the sun actually is over Spokane, which
 * three-scene.js uses to tint the sky you land on.
 *
 * Algorithm is the standard low-precision NOAA/Astronomical-Almanac solar
 * position (accurate to ~0.01°, which is far finer than anything visible here).
 */

// Spokane International Airport — the GEG waypoint on the radar.
export const GEG = { lat: 47.6588, lon: -117.426, tz: 'America/Los_Angeles' };

const RAD = Math.PI / 180;

// Sun is "set" when its centre is 0.833° below the horizon — half the solar
// disc (0.266°) plus standard atmospheric refraction (0.567°).
const HORIZON = -0.833;

/**
 * Sun elevation and azimuth in degrees for a given instant and location.
 * Elevation is angle above the horizon (negative = below); azimuth is degrees
 * clockwise from true north.
 */
export function solarPosition(date, latDeg = GEG.lat, lonDeg = GEG.lon) {
  // Days since the J2000.0 epoch.
  const jd = date.getTime() / 86400000 + 2440587.5;
  const n = jd - 2451545.0;

  // Mean longitude and mean anomaly of the sun.
  const L = (((280.46 + 0.9856474 * n) % 360) + 360) % 360;
  const g = (((357.528 + 0.9856003 * n) % 360) + 360) % 360;

  // Ecliptic longitude (mean longitude plus equation of centre).
  const lambda = L + 1.915 * Math.sin(g * RAD) + 0.02 * Math.sin(2 * g * RAD);

  // Obliquity of the ecliptic.
  const epsilon = 23.439 - 0.0000004 * n;

  // Declination and right ascension.
  const delta = Math.asin(Math.sin(epsilon * RAD) * Math.sin(lambda * RAD));
  const alpha = Math.atan2(
    Math.cos(epsilon * RAD) * Math.sin(lambda * RAD),
    Math.cos(lambda * RAD)
  );

  // Local mean sidereal time -> hour angle.
  const gmst = (((18.697374558 + 24.06570982441908 * n) % 24) + 24) % 24;
  const lmst = (((gmst + lonDeg / 15) % 24) + 24) % 24;
  const H = lmst * 15 * RAD - alpha;

  const lat = latDeg * RAD;
  const elevation = Math.asin(
    Math.sin(lat) * Math.sin(delta) +
      Math.cos(lat) * Math.cos(delta) * Math.cos(H)
  );
  const azimuth = Math.atan2(
    -Math.sin(H),
    Math.tan(delta) * Math.cos(lat) - Math.sin(lat) * Math.cos(H)
  );

  return {
    elevation: elevation / RAD,
    azimuth: ((azimuth / RAD) % 360 + 360) % 360
  };
}

/**
 * The next sunrise or sunset after `date`, found by scanning forward a minute
 * at a time for a horizon crossing.
 *
 * Deliberately numeric rather than analytic: 1440 evaluations of cheap
 * trigonometry costs well under a millisecond and runs once per page load,
 * and it can't be subtly wrong the way hand-rolled transit-time algebra can.
 */
export function nextSunEvent(date, latDeg = GEG.lat, lonDeg = GEG.lon) {
  let previous = solarPosition(date, latDeg, lonDeg).elevation > HORIZON;

  for (let minute = 1; minute <= 1440; minute++) {
    const at = new Date(date.getTime() + minute * 60000);
    const up = solarPosition(at, latDeg, lonDeg).elevation > HORIZON;

    if (up !== previous) {
      return { type: up ? 'sunrise' : 'sunset', at };
    }
    previous = up;
  }

  // Polar day or night — no crossing within 24h. Spokane never hits this, but
  // the function shouldn't lie about it if the coordinates ever change.
  return null;
}

/**
 * Whether the sun is climbing. Morning low sun and evening low sun sit at the
 * same elevation but should not look the same — this picks dawn vs sunset.
 */
function isRising(date, latDeg, lonDeg) {
  const now = solarPosition(date, latDeg, lonDeg).elevation;
  const later = solarPosition(
    new Date(date.getTime() + 600000),
    latDeg,
    lonDeg
  ).elevation;
  return later > now;
}

// Elevation keyframes mapping the sun's height onto the scene's existing four
// palettes. `twilight` resolves to dawn when the sun is climbing and sunset
// when it's dropping. Interpolating between adjacent stops keeps the sky
// continuous as the sun moves.
const STOPS = [
  { elevation: -18, palette: 'night', stars: 1.0 },
  { elevation: -6, palette: 'night', stars: 0.9 },
  { elevation: 0, palette: 'twilight', stars: 0.35 },
  { elevation: 10, palette: 'twilight', stars: 0.05 },
  { elevation: 30, palette: 'noon', stars: 0.0 },
  { elevation: 90, palette: 'noon', stars: 0.0 }
];

function phaseLabel(elevation) {
  if (elevation > 30) return 'FULL DAYLIGHT';
  if (elevation > 6) return 'DAYLIGHT';
  if (elevation > HORIZON) return 'GOLDEN HOUR';
  if (elevation > -6) return 'CIVIL TWILIGHT';
  if (elevation > -12) return 'NAUTICAL TWILIGHT';
  // Astronomical twilight and true night render identically here, and spelling
  // out "ASTRONOMICAL TWILIGHT" overflows the radar readout — so call it night.
  return 'NIGHT';
}

/**
 * Everything the scene needs to render the real sky over Spokane right now:
 * which two palettes to blend and by how much, how visible the stars should
 * be, where the sun sits, and what to print on the HUD.
 */
export function skyStateFor(date = new Date(), latDeg = GEG.lat, lonDeg = GEG.lon) {
  const { elevation, azimuth } = solarPosition(date, latDeg, lonDeg);
  const rising = isRising(date, latDeg, lonDeg);
  const twilight = rising ? 'dawn' : 'sunset';
  const resolve = (name) => (name === 'twilight' ? twilight : name);

  const clamped = Math.max(STOPS[0].elevation, Math.min(90, elevation));
  let lower = STOPS[0];
  let upper = STOPS[STOPS.length - 1];

  for (let i = 0; i < STOPS.length - 1; i++) {
    if (clamped >= STOPS[i].elevation && clamped <= STOPS[i + 1].elevation) {
      lower = STOPS[i];
      upper = STOPS[i + 1];
      break;
    }
  }

  const span = upper.elevation - lower.elevation;
  const t = span === 0 ? 0 : (clamped - lower.elevation) / span;

  return {
    elevation,
    azimuth,
    rising,
    from: resolve(lower.palette),
    to: resolve(upper.palette),
    t,
    starOpacity: lower.stars + (upper.stars - lower.stars) * t,
    phase: phaseLabel(elevation),
    nextEvent: nextSunEvent(date, latDeg, lonDeg)
  };
}

/** Local clock time at the airport, e.g. "20:35". */
export function localTime(date, tz = GEG.tz) {
  return date.toLocaleTimeString('en-US', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}
