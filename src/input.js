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
