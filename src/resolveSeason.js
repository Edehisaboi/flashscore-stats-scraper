import { load } from 'cheerio';
import { gotScraping } from 'got-scraping';
import { buildArchiveUrl, getSeasonDisplayLabel, getSeasonLabel } from './competitions.js';
import { cleanText, logInfo } from './util.js';

export async function resolveSeason(options) {
  const { competition, year, proxyConfiguration, log } = options;
  const archiveUrl = buildArchiveUrl(competition);

  logInfo(log, `Resolving ${competition.title} ${getSeasonDisplayLabel(competition, year)} from archive`, {
    archiveUrl,
  });

  const html = await fetchArchiveHtml(archiveUrl, proxyConfiguration);
  const seasonLink = findSeasonLink(html, archiveUrl, competition, year);

  if (!seasonLink) {
    throw new Error(
      `Could not resolve ${competition.title} ${getSeasonDisplayLabel(competition, year)} from ${archiveUrl}. ` +
      'The competition may not exist for that year, or the catalog slug may need updating.',
    );
  }

  return {
    archiveUrl,
    seasonUrl: seasonLink.seasonUrl,
    resultsUrl: toResultsUrl(seasonLink.seasonUrl),
    season: getSeasonLabel(competition, year),
    label: seasonLink.label,
  };
}

export function findSeasonLink(html, archiveUrl, competition, year) {
  const $ = load(html);
  const anchorCandidates = $('a[href]')
    .map((_, element) => {
      const href = $(element).attr('href');
      const label = cleanText($(element).text());

      if (!href || !label) {
        return null;
      }

      return {
        href,
        label,
        seasonUrl: new URL(href, archiveUrl).href,
      };
    })
    .get()
    .filter(Boolean);

  // Flashscore server-renders the archive season list as an embedded JSON blob
  // (e.g. "name":"Premier League 2024/2025","url":"/football/.../premier-league-2024-2025/")
  // rather than as <a> tags, so anchor scraping alone finds nothing without JS.
  const jsonCandidates = extractJsonSeasonCandidates(html, archiveUrl);
  const candidates = [...anchorCandidates, ...jsonCandidates];

  const matches = candidates.filter((candidate) => isSeasonCandidate(candidate, competition, year));

  matches.sort((left, right) => scoreCandidate(right, competition, year) - scoreCandidate(left, competition, year));

  return matches[0] || null;
}

export function extractJsonSeasonCandidates(html, archiveUrl) {
  const pattern = /"name":"([^"]+)","url":"(\\?\/football\\?\/[^"]+?\\?\/)"/g;
  const candidates = [];
  let match;

  while ((match = pattern.exec(String(html ?? ''))) !== null) {
    const label = cleanText(match[1].replace(/\\\//g, '/'));
    const href = match[2].replace(/\\\//g, '/');

    if (!href) {
      continue;
    }

    candidates.push({
      href,
      label,
      seasonUrl: new URL(href, archiveUrl).href,
    });
  }

  return candidates;
}

async function fetchArchiveHtml(archiveUrl, proxyConfiguration) {
  const proxyUrl = proxyConfiguration?.newUrl ? await proxyConfiguration.newUrl('archive') : undefined;
  const response = await gotScraping({
    url: archiveUrl,
    proxyUrl,
    responseType: 'text',
    timeout: { request: 30000 },
    headers: {
      'accept-language': 'en-US,en;q=0.9',
      referer: 'https://www.flashscore.com/',
    },
    throwHttpErrors: false,
  });

  const statusCode = typeof response === 'string' ? 200 : response.statusCode;
  const body = typeof response === 'string' ? response : response.body;

  if (statusCode < 200 || statusCode >= 300) {
    throw new Error(`Archive request failed with HTTP ${statusCode}: ${archiveUrl}`);
  }

  return body;
}

function isSeasonCandidate(candidate, competition, year) {
  const normalizedText = normalizeSeasonText(candidate.label);
  const normalizedHref = normalizeSeasonText(candidate.seasonUrl);
  const patterns = getSeasonPatterns(competition, year).map(normalizeSeasonText);

  return patterns.some((pattern) => normalizedText.includes(pattern) || normalizedHref.includes(pattern));
}

function scoreCandidate(candidate, competition, year) {
  const normalizedHref = normalizeSeasonText(candidate.seasonUrl);
  const normalizedSlug = normalizeSeasonText(competition.slug);
  const fullSeason = normalizeSeasonText(getSeasonLabel(competition, year));
  const shortSeason = normalizeSeasonText(
    competition.seasonType === 'season' ? `${year}-${String(year + 1).slice(-2)}` : String(year),
  );

  let score = 0;

  if (normalizedHref.includes(`${normalizedSlug}_${fullSeason}`)) {
    score += 5;
  }

  if (normalizedHref.includes(fullSeason)) {
    score += 3;
  }

  if (normalizedHref.includes(shortSeason)) {
    score += 2;
  }

  return score;
}

function getSeasonPatterns(competition, year) {
  if (competition.seasonType === 'calendar') {
    return [String(year)];
  }

  return [
    `${year}/${year + 1}`,
    `${year}-${year + 1}`,
    `${year}/${String(year + 1).slice(-2)}`,
    `${year}-${String(year + 1).slice(-2)}`,
  ];
}

function normalizeSeasonText(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/%2f/g, '/')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function toResultsUrl(seasonUrl) {
  const url = seasonUrl.endsWith('/') ? seasonUrl : `${seasonUrl}/`;
  return `${url}results/`;
}
