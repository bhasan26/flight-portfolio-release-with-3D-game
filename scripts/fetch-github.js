/**
 * Build-time GitHub telemetry fetch.
 *
 * Pulls public activity for GITHUB_USER and writes github-stats.json, which
 * main.js imports so Vite inlines it into the bundle. Nothing is fetched at
 * runtime — no API key, no rate limits on visitors, no CSP change needed.
 *
 * Run via `npm run build` (prebuild) or directly: `node scripts/fetch-github.js`
 *
 * IMPORTANT: this never fails the build. On any network/API error it leaves the
 * committed github-stats.json in place and exits 0, so a GitHub outage or an
 * offline build can't take the site down.
 */

import { writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const GITHUB_USER = 'bhasan26';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_FILE = join(ROOT, 'github-stats.json');

// The public events feed is capped at ~300 events / 90 days by GitHub. Every
// commit-derived number below is therefore "within the visible window", not
// all-time — the output records the window so the UI can label it honestly.
const EVENT_PAGES = 3;
const DAY_MS = 86400000;

// PushEvent no longer carries payload.size, so commit counts come from the
// commits API instead — one request per recently-pushed repo. Capped because
// unauthenticated GitHub allows 60 requests/hour per IP and a build already
// spends 3 on the profile/repos/events calls.
const MAX_COMMIT_REPOS = 10;

// Deliberately kept in step with how far the events feed reaches. Which repos
// to count is discovered FROM that feed, so widening this alone would count
// 90 days of commits in only the repos active in the last 30 — under-counting
// older weeks and drawing a fake upward trend in the sparkline.
const COMMIT_WINDOW_DAYS = 30;

// Unauthenticated GitHub allows only 60 requests/hour PER IP — and CI builders
// share IPs, so a busy build host can exhaust that. Set GITHUB_TOKEN (a fine-
// grained token with public read access is enough) to get 5,000/hour instead.
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

const api = async (path) => {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': `${GITHUB_USER}-portfolio-build`,
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {})
    }
  });
  if (!res.ok) {
    throw new Error(`GET ${path} -> ${res.status} ${res.statusText}`);
  }
  return res.json();
};

const utcDay = (iso) => new Date(iso).toISOString().slice(0, 10);

async function fetchEvents() {
  const events = [];
  for (let page = 1; page <= EVENT_PAGES; page++) {
    const batch = await api(
      `/users/${GITHUB_USER}/events/public?per_page=100&page=${page}`
    );
    events.push(...batch);
    if (batch.length < 100) break; // no further pages
  }
  return events;
}

/**
 * Real commit timestamps for every repo the user pushed to recently.
 * Deduped by SHA — a fork and its upstream share history, so the same commit
 * can legitimately come back from two different repos.
 */
async function fetchCommitDates(repoNames) {
  const since = new Date(Date.now() - COMMIT_WINDOW_DAYS * DAY_MS).toISOString();
  const bySha = new Map();
  const skipped = [];

  for (const name of repoNames.slice(0, MAX_COMMIT_REPOS)) {
    try {
      // Deliberately no `author=` query param: filtering by username server-side
      // is unreliable (it under-reports badly — 1 result where an unfiltered
      // query returns 6). The `author.login` field in the response body is
      // accurate, so filter on that instead.
      const commits = await api(
        `/repos/${name}/commits?since=${since}&per_page=100`
      );
      for (const c of commits) {
        if (c.author?.login?.toLowerCase() !== GITHUB_USER.toLowerCase()) continue;
        const date = c.commit?.author?.date ?? c.commit?.committer?.date;
        if (c.sha && date) bySha.set(c.sha, date);
      }
    } catch (err) {
      // Empty repo (409), moved, or rate-limited — skip it rather than losing
      // every other repo's commits. The caller uses `skipped` to decide whether
      // the resulting counts are trustworthy enough to publish.
      skipped.push(name);
      console.warn(`[github]   skipped ${name}: ${err.message}`);
    }
  }

  return { dates: [...bySha.values()].sort(), skipped };
}

function summarize(profile, repos, events, commitDates) {
  const now = Date.now();
  const pushes = events.filter((e) => e.type === 'PushEvent');

  // How far back the events feed reaches. Repo/push-derived numbers are bounded
  // by this, so report it rather than implying all-time totals.
  const oldestEvent = events.length
    ? new Date(events[events.length - 1].created_at).getTime()
    : now;
  const windowDays = Math.max(1, Math.round((now - oldestEvent) / DAY_MS));

  const commitTimes = commitDates.map((d) => new Date(d).getTime());
  const commitsSince = (days) =>
    commitTimes.filter((t) => now - t <= days * DAY_MS).length;

  const commits7d = commitsSince(7);
  const commits30d = commitsSince(30);

  // Distinct repos pushed to in the last 30 days.
  const activeRepos = new Set(
    pushes
      .filter((e) => now - new Date(e.created_at).getTime() <= 30 * DAY_MS)
      .map((e) => e.repo?.name)
      .filter(Boolean)
  ).size;

  // Consecutive UTC days with a commit, counting back from today. This is NOT
  // GitHub's contribution streak — that needs an authenticated GraphQL call and
  // includes private work. Labelled "ACTIVE DAYS" in the UI for that reason.
  const commitDays = new Set(commitDates.map(utcDay));
  let streak = 0;
  for (let i = 0; i <= COMMIT_WINDOW_DAYS; i++) {
    const day = new Date(now - i * DAY_MS).toISOString().slice(0, 10);
    if (commitDays.has(day)) {
      streak++;
    } else if (i > 0) {
      break; // today with no commit yet doesn't end a streak
    }
  }

  // Commits bucketed by week, oldest first, for the sparkline.
  const weekCount = Math.max(1, Math.floor(COMMIT_WINDOW_DAYS / 7));
  const weeklyCommits = [];
  for (let w = weekCount - 1; w >= 0; w--) {
    const end = now - w * 7 * DAY_MS;
    const start = end - 7 * DAY_MS;
    weeklyCommits.push(
      commitTimes.filter((t) => t > start && t <= end).length
    );
  }

  // Engine N1 reads commits-this-week against the busiest week on record. The
  // floor of 15 stops a single quiet week from pinning the needle at 100%.
  const peakWeek = Math.max(15, ...weeklyCommits, commits7d);
  const enginePct = Math.round((commits7d / peakWeek) * 100);

  const ownRepos = repos.filter((r) => !r.fork);
  const languageCounts = {};
  for (const repo of ownRepos) {
    if (repo.language) {
      languageCounts[repo.language] = (languageCounts[repo.language] || 0) + 1;
    }
  }
  const topLanguages = Object.entries(languageCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name, count]) => ({ name, count }));

  const lastPush = pushes.length ? pushes[0].created_at : null;
  const stars = ownRepos.reduce((sum, r) => sum + (r.stargazers_count || 0), 0);

  return {
    generatedAt: new Date().toISOString(),
    user: GITHUB_USER,
    windowDays,
    commitWindowDays: COMMIT_WINDOW_DAYS,
    commits7d,
    commits30d,
    activeRepos,
    streak,
    weeklyCommits,
    enginePct: Math.max(0, Math.min(100, enginePct)),
    lastPush,
    publicRepos: profile.public_repos ?? ownRepos.length,
    followers: profile.followers ?? 0,
    stars,
    topLanguages,
    memberSince: profile.created_at ?? null
  };
}

async function main() {
  const [profile, repos, events] = await Promise.all([
    api(`/users/${GITHUB_USER}`),
    api(`/users/${GITHUB_USER}/repos?per_page=100&sort=pushed&direction=desc`),
    fetchEvents()
  ]);

  // Repos to count commits in, most-recently-pushed first.
  const recentlyPushed = [
    ...new Set(
      events
        .filter((e) => e.type === 'PushEvent')
        .map((e) => e.repo?.name)
        .filter(Boolean)
    )
  ];

  const { dates, skipped } = await fetchCommitDates(recentlyPushed);
  const stats = summarize(profile, repos, events, dates);
  stats.partial = skipped.length > 0;

  // A partial run under-counts commits. Publishing it would silently replace
  // accurate numbers with lower ones, so keep the previous complete snapshot.
  if (stats.partial) {
    const previous = await readSnapshot();
    if (previous && !previous.partial) {
      console.warn(
        `[github] ${skipped.length} repo(s) unreadable — keeping the complete ` +
          `snapshot from ${previous.generatedAt} instead of publishing ` +
          `under-counted stats (${stats.commits30d} vs ${previous.commits30d} commits/30d).`
      );
      if (!TOKEN) {
        console.warn(
          '[github] Set GITHUB_TOKEN to raise the API limit from 60 to 5,000 requests/hour.'
        );
      }
      return;
    }
  }

  await writeFile(OUT_FILE, `${JSON.stringify(stats, null, 2)}\n`);

  console.log(
    `[github] ${stats.commits7d} commits/7d · ${stats.commits30d} commits/30d · ` +
      `${stats.activeRepos} active repos · ${stats.streak}d streak · ` +
      `${stats.publicRepos} public repos${stats.partial ? ' (PARTIAL)' : ''}`
  );
}

async function readSnapshot() {
  try {
    return JSON.parse(await readFile(OUT_FILE, 'utf8'));
  } catch {
    return null;
  }
}

main().catch(async (err) => {
  console.warn(`[github] fetch failed, keeping existing stats: ${err.message}`);
  const existing = await readSnapshot();
  if (existing) {
    console.warn(`[github] last good snapshot: ${existing.generatedAt}`);
  } else {
    // No snapshot at all — write a neutral one so the import never breaks.
    await writeFile(
      OUT_FILE,
      `${JSON.stringify(
        {
          generatedAt: null,
          user: GITHUB_USER,
          windowDays: 0,
          commits7d: 0,
          commits30d: 0,
          activeRepos: 0,
          streak: 0,
          weeklyCommits: [],
          enginePct: 0,
          lastPush: null,
          publicRepos: 0,
          followers: 0,
          stars: 0,
          topLanguages: [],
          memberSince: null
        },
        null,
        2
      )}\n`
    );
  }
  process.exit(0);
});
