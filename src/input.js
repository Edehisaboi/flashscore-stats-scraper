import { COMPETITIONS, getCompetition } from './competitions.js';

export const DEFAULT_PROXY_CONFIGURATION = Object.freeze({
  useApifyProxy: true,
  apifyProxyGroups: ['BUYPROXIES94952'],
});

export function resolveJobs(input = {}) {
  const rawJobs = Array.isArray(input.jobs) && input.jobs.length
    ? input.jobs
    : [{ competition: input.competition || COMPETITIONS[0].key, year: input.year ?? 2024 }];

  return rawJobs.map((job, index) => {
    if (!job || typeof job !== 'object') {
      throw new Error(`Job at index ${index} must be an object`);
    }

    const competition = String(job.competition || '').trim();
    const year = Number(job.year);

    getCompetition(competition);

    if (!Number.isInteger(year) || year < 1900 || year > 2100) {
      throw new Error(`Job ${competition || index} has invalid year "${job.year}"`);
    }

    return { competition, year };
  });
}

export const MODES = Object.freeze(['fixtures', 'season_stats', 'fetch_stats']);

const DEFAULT_MODE = 'season_stats';

export function resolveMode(input = {}) {
  const mode = String(input.mode ?? '').trim();

  if (!mode) {
    return DEFAULT_MODE;
  }

  if (!MODES.includes(mode)) {
    throw new Error(`Unknown mode "${mode}". Expected one of: ${MODES.join(', ')}`);
  }

  return mode;
}

// fetch_stats scrapes named matches rather than discovering them, so the only
// input it needs is the list of Flashscore match ids. Callers that already hold
// those ids (ParlayHux stores one per fixture) skip season resolution and match
// enumeration entirely.
export function resolveMatchIds(input = {}) {
  const requested = Array.isArray(input.matchIds) ? input.matchIds : [];
  const ids = [...new Set(
    requested.map((id) => String(id ?? '').trim()).filter(Boolean),
  )];

  if (!ids.length) {
    throw new Error('fetch_stats mode requires a non-empty matchIds list');
  }

  return ids;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_FIXTURE_DAYS = 7;
const MAX_FIXTURE_DAYS = 30;

function isDay(value) {
  const ms = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(ms) && new Date(ms).toISOString().slice(0, 10) === value;
}

// Fixtures runs scrape upcoming matches for a set of competitions from now up to
// an end date, so they take a competition list + endDate instead of per-year
// jobs. The end date is a UTC calendar day and is inclusive: left empty it is a
// week from today, a date that does not exist falls back to today, and nothing
// past 30 days ahead is chased.
export function resolveFixtureRun(input = {}, now = new Date()) {
  const day = (offset) => new Date(now.getTime() + offset * DAY_MS).toISOString().slice(0, 10);
  const given = String(input.endDate ?? '').trim() || day(DEFAULT_FIXTURE_DAYS);
  const asked = isDay(given) ? given : day(0);

  if (asked < day(0)) {
    throw new Error(`endDate must not be before today, got "${asked}"`);
  }

  const endDate = asked > day(MAX_FIXTURE_DAYS) ? day(MAX_FIXTURE_DAYS) : asked;
  const endMs = Date.parse(`${endDate}T23:59:59.999Z`);

  const requested = input.competitions;
  const wantsAll = requested === 'all' ||
    (Array.isArray(requested) && requested.map(String).includes('all'));

  let keys;
  if (wantsAll) {
    keys = COMPETITIONS.map((competition) => competition.key);
  } else if (Array.isArray(requested) && requested.length) {
    keys = requested.map((key) => String(key).trim()).filter(Boolean);
  } else {
    keys = [COMPETITIONS[0].key];
  }

  const unique = [...new Set(keys)];
  unique.forEach((key) => getCompetition(key));

  return { competitions: unique, endDate, endMs };
}

export function normalizeProxyConfiguration(proxyConfiguration) {
  if (!proxyConfiguration || typeof proxyConfiguration !== 'object') {
    return DEFAULT_PROXY_CONFIGURATION;
  }

  if (proxyConfiguration.apifyProxyGroups && !proxyConfiguration.groups) {
    return {
      ...proxyConfiguration,
      groups: proxyConfiguration.apifyProxyGroups,
    };
  }

  return proxyConfiguration;
}
