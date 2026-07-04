import { gotScraping } from 'got-scraping';
import { FLASH_SCORE_BASE_URL } from './competitions.js';
import { DEFAULT_FSIGN, FEED_HOSTS } from './feeds.js';
import { cleanText, logInfo, logWarning } from './util.js';

const MAX_FEED_PAGES = 40;
const RECORD_SEPARATOR = '~';
const FIELD_SEPARATOR = '¬';
const KEY_VALUE_SEPARATOR = '÷';

// Enumerate every match in a season by parsing the results page's embedded
// match records (recent rounds) plus the paginated results feed (older rounds).
// This is pure HTTP (no browser), so it works reliably through the datacenter
// proxy just like the statistics feeds do.
export async function enumerateMatches(options) {
  const { resultsUrl, competition, year, proxyConfiguration, log } = options;

  const html = await fetchResultsHtml(resultsUrl, proxyConfiguration);
  const feedParams = extractFeedParams(html);
  const byId = new Map();

  for (const record of parseMatchRecords(html)) {
    byId.set(record.mid, record);
  }

  if (feedParams) {
    for (let page = 1; page <= MAX_FEED_PAGES; page += 1) {
      const body = await fetchResultsFeed(feedParams, page, proxyConfiguration);

      if (!body || !body.trim()) {
        break;
      }

      const records = parseMatchRecords(body);

      if (!records.length) {
        break;
      }

      for (const record of records) {
        byId.set(record.mid, record);
      }
    }
  } else {
    logWarning(log, 'Could not extract results feed parameters; only embedded matches enumerated', { resultsUrl });
  }

  const matches = [...byId.values()].map((record) => normalizeRecord(record, competition, year));

  logInfo(log, `Enumerated ${matches.length} matches from ${competition.title}`, { resultsUrl });

  return { matches, liveFsign: null };
}

async function fetchResultsHtml(resultsUrl, proxyConfiguration) {
  const proxyUrl = proxyConfiguration?.newUrl ? await proxyConfiguration.newUrl('results') : undefined;
  const response = await gotScraping({
    url: resultsUrl,
    proxyUrl,
    responseType: 'text',
    timeout: { request: 30000 },
    throwHttpErrors: false,
    headers: {
      'accept-language': 'en-US,en;q=0.9',
      referer: 'https://www.flashscore.com/',
    },
  });

  const statusCode = typeof response === 'string' ? 200 : response.statusCode;
  const body = typeof response === 'string' ? response : response.body;

  if (statusCode < 200 || statusCode >= 300) {
    throw new Error(`Results request failed with HTTP ${statusCode}: ${resultsUrl}`);
  }

  return body;
}

// The results page embeds the feed prefix (sport_category_template) as a string
// and the seasonId separately. The feed URL is
// tr_1_{category}_{templateId}_{seasonId}_{page}_1_en_1.
export function extractFeedParams(html) {
  const templateId = (String(html).match(/TemplateId:\s*"([A-Za-z0-9]+)"/) || [])[1];
  const seasonId = (String(html).match(/seasonId:\s*(\d+)/) || [])[1];

  if (!templateId || !seasonId) {
    return null;
  }

  const category = (String(html).match(new RegExp(`1_(\\d+)_${templateId}`)) || [])[1];

  if (!category) {
    return null;
  }

  return { category, templateId, seasonId };
}

async function fetchResultsFeed(params, page, proxyConfiguration) {
  const feedName = `tr_1_${params.category}_${params.templateId}_${params.seasonId}_${page}_1_en_1`;

  for (let attempt = 0; attempt < FEED_HOSTS.length; attempt += 1) {
    const host = FEED_HOSTS[attempt];
    const proxyUrl = proxyConfiguration?.newUrl
      ? await proxyConfiguration.newUrl(`results_${params.seasonId}_${page}`)
      : undefined;

    try {
      const response = await gotScraping({
        url: `https://${host}.flashscore.ninja/2/x/feed/${feedName}`,
        proxyUrl,
        responseType: 'text',
        timeout: { request: 20000 },
        throwHttpErrors: false,
        retry: { limit: 0 },
        headers: {
          'x-fsign': DEFAULT_FSIGN,
          accept: '*/*',
          'accept-language': 'en-US,en;q=0.9',
          referer: 'https://www.flashscore.com/',
        },
      });

      const statusCode = typeof response === 'string' ? 200 : response.statusCode;
      const body = typeof response === 'string' ? response : response.body;

      if (statusCode >= 200 && statusCode < 300 && !/^\s*<(?:!doctype|html)/i.test(body || '')) {
        return body;
      }
    } catch {
      // Rotate to the next host.
    }
  }

  return '';
}

export function parseMatchRecords(blob) {
  const records = [];

  for (const rawRecord of String(blob ?? '').split(RECORD_SEPARATOR)) {
    if (!rawRecord.includes(`AA${KEY_VALUE_SEPARATOR}`)) {
      continue;
    }

    const fields = {};
    for (const rawField of rawRecord.split(FIELD_SEPARATOR)) {
      const index = rawField.indexOf(KEY_VALUE_SEPARATOR);
      if (index > 0) {
        fields[rawField.slice(0, index)] = rawField.slice(index + 1);
      }
    }

    if (!fields.AA) {
      continue;
    }

    records.push({
      mid: fields.AA,
      homeTeam: fields.AE || '',
      awayTeam: fields.AF || '',
      homeTeamId: fields.PX || '',
      awayTeamId: fields.PY || '',
      homeSlug: fields.WU || '',
      awaySlug: fields.WV || '',
      homeScore: fields.AG ?? '',
      awayScore: fields.AH ?? '',
      round: fields.ER || '',
      timestamp: fields.AD || fields.ADE || '',
      statusCode: fields.AC || '',
    });
  }

  return records;
}

function normalizeRecord(record, competition, year) {
  const dateUtc = record.timestamp
    ? new Date(Number.parseInt(record.timestamp, 10) * 1000).toISOString()
    : '';

  return {
    mid: record.mid,
    matchUrl: buildMatchUrl(record),
    status: statusFromCode(record.statusCode),
    dateUtc,
    kickoff: dateUtc,
    round: cleanText(record.round),
    homeTeam: cleanText(record.homeTeam),
    homeTeamId: record.homeTeamId,
    awayTeam: cleanText(record.awayTeam),
    awayTeamId: record.awayTeamId,
    // Regulation scores are authoritative from the summary feed (merged later);
    // these are fallbacks if that feed is unavailable.
    homeScoreFt: cleanText(record.homeScore),
    awayScoreFt: cleanText(record.awayScore),
    homeScoreHt: '',
    awayScoreHt: '',
    competition: competition.title,
    country: competition.country,
    season: undefined,
    year,
  };
}

function buildMatchUrl(record) {
  if (record.homeSlug && record.awaySlug && record.homeTeamId && record.awayTeamId) {
    return `${FLASH_SCORE_BASE_URL}/match/football/${record.homeSlug}-${record.homeTeamId}/${record.awaySlug}-${record.awayTeamId}/?mid=${record.mid}`;
  }

  return `${FLASH_SCORE_BASE_URL}/match/${record.mid}/#/match-summary`;
}

function statusFromCode(code) {
  switch (String(code)) {
    case '3':
      return 'Finished';
    case '1':
      return 'Scheduled';
    case '2':
      return 'Live';
    case '4':
      return 'Postponed';
    case '5':
      return 'Cancelled';
    case '6':
      return 'Abandoned';
    case '9':
      return 'Awarded';
    case '10':
      return 'After Extra Time';
    case '11':
      return 'After Penalties';
    default:
      return code ? `Status ${code}` : '';
  }
}
