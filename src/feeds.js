import { gotScraping } from 'got-scraping';
import { logWarning, sleep } from './util.js';

export const DEFAULT_FSIGN = 'SW9D1eZo';
export const FEED_HOSTS = Object.freeze(['global', '2', '46']);

const MAX_RETRIES_PER_PROXY_TIER = 3;
const BLOCK_BODY_RE = /captcha|cloudflare|access denied|forbidden|unusual traffic|verify you are human/i;

export function buildFeedUrl(feedName, mid, host = FEED_HOSTS[0]) {
  return `https://${host}.flashscore.ninja/2/x/feed/${feedName}_${mid}`;
}

export function buildStatsUrl(mid, host = FEED_HOSTS[0]) {
  return buildFeedUrl('df_st_1', mid, host);
}

// Detailed team statistics feed (FT / 1st half / 2nd half).
export function fetchStats(mid, options = {}) {
  return fetchFeed('df_st_1', mid, options);
}

// Match summary feed: half-by-half scores, penalties, referee, venue, attendance.
export function fetchSummary(mid, options = {}) {
  return fetchFeed('df_sur_1', mid, options);
}

async function fetchFeed(feedName, mid, options = {}) {
  const {
    proxyConfiguration,
    residentialProxyConfiguration,
    fsign = DEFAULT_FSIGN,
    fallbackFsign,
    log,
  } = options;
  const tokens = [...new Set([fsign, fallbackFsign].filter(Boolean))];
  const proxyTiers = [
    { name: 'primary', configuration: proxyConfiguration },
    { name: 'residential', configuration: residentialProxyConfiguration },
  ].filter((tier, index) => index === 0 || tier.configuration);

  let lastError = null;
  let lastEmptyResponse = null;

  for (const token of tokens) {
    for (const proxyTier of proxyTiers) {
      for (let attempt = 0; attempt < MAX_RETRIES_PER_PROXY_TIER; attempt += 1) {
        const host = FEED_HOSTS[attempt % FEED_HOSTS.length];
        const url = buildFeedUrl(feedName, mid, host);

        try {
          const response = await requestStatsUrl(url, {
            proxyConfiguration: proxyTier.configuration,
            token,
            mid,
          });

          if (isSuccessfulStatsResponse(response)) {
            return {
              body: response.body,
              statusCode: response.statusCode,
              host,
              fsign: token,
              proxyTier: proxyTier.name,
              noStats: false,
            };
          }

          if (response.statusCode === 404) {
            return {
              body: '',
              statusCode: response.statusCode,
              host,
              fsign: token,
              proxyTier: proxyTier.name,
              noStats: true,
            };
          }

          if (response.statusCode === 200 && !String(response.body || '').trim()) {
            lastEmptyResponse = {
              body: '',
              statusCode: response.statusCode,
              host,
              fsign: token,
              proxyTier: proxyTier.name,
              noStats: true,
            };
          }

          if (!isBlockedResponse(response) && response.statusCode >= 400 && response.statusCode < 500) {
            throw new Error(`Stats feed returned HTTP ${response.statusCode} for ${mid}`);
          }
        } catch (error) {
          lastError = error;
        }

        await sleep(500 * (attempt + 1));
      }
    }
  }

  if (lastEmptyResponse) {
    logWarning(log, `Stats feed was empty for ${mid}; emitting metadata-only row`);
    return lastEmptyResponse;
  }

  throw lastError || new Error(`Could not fetch stats for ${mid}`);
}

async function requestStatsUrl(url, options) {
  // Apify proxy session ids must match /^[\w._~]+$/ (no hyphens), so keep the
  // session token underscore-delimited and strip any other characters.
  const sessionId = `stats_${String(options.mid).replace(/[^\w.~]/g, '')}`;
  const proxyUrl = options.proxyConfiguration?.newUrl
    ? await options.proxyConfiguration.newUrl(sessionId)
    : undefined;
  const response = await gotScraping({
    url,
    proxyUrl,
    responseType: 'text',
    timeout: { request: 15000 },
    throwHttpErrors: false,
    retry: { limit: 0 },
    headers: {
      'x-fsign': options.token,
      accept: '*/*',
      'accept-language': 'en-US,en;q=0.9',
      origin: 'https://www.flashscore.com',
      referer: 'https://www.flashscore.com/',
    },
  });

  if (typeof response === 'string') {
    return {
      statusCode: 200,
      body: response,
      headers: {},
    };
  }

  return {
    statusCode: response.statusCode,
    body: response.body,
    headers: response.headers || {},
  };
}

function isSuccessfulStatsResponse(response) {
  const body = String(response.body || '');
  return response.statusCode === 200 && body.trim() && !isHtmlBody(body) && !BLOCK_BODY_RE.test(body);
}

function isBlockedResponse(response) {
  const body = String(response.body || '');
  return response.statusCode === 403 ||
    response.statusCode === 429 ||
    isHtmlBody(body) ||
    BLOCK_BODY_RE.test(body) ||
    (response.statusCode === 200 && !body.trim());
}

function isHtmlBody(body) {
  return /^\s*<!doctype html/i.test(body) || /^\s*<html[\s>]/i.test(body);
}
