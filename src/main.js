import { Actor, log } from 'apify';
import pLimit from 'p-limit';
import { buildRow, createRowPlan } from './buildRow.js';
import { getCompetition } from './competitions.js';
import { enumerateMatches } from './enumerate.js';
import { fetchStats, fetchSummary } from './feeds.js';
import { DEFAULT_PROXY_CONFIGURATION, normalizeProxyConfiguration, resolveJobs } from './input.js';
import { parseStatsFeed } from './parseStats.js';
import { parseSummaryFeed } from './parseSummary.js';
import { resolveSeason } from './resolveSeason.js';
import { logInfo, logWarning } from './util.js';

await Actor.main(async () => {
  const input = await Actor.getInput() || {};
  const jobs = resolveJobs(input);
  const includePeriods = input.includePeriods || ['ft', '1h'];
  // Cup competitions include early qualifying rounds with no statistics; by
  // default we drop stat-less matches so the output only contains useful rows.
  const onlyWithStats = input.onlyWithStats !== false;
  const maxConcurrency = Number.isInteger(input.maxConcurrency) ? input.maxConcurrency : 10;
  const proxyInput = normalizeProxyConfiguration(input.proxyConfiguration || DEFAULT_PROXY_CONFIGURATION);
  const proxyConfiguration = await Actor.createProxyConfiguration(proxyInput);
  const residentialProxyConfiguration = proxyInput.useApifyProxy === false
    ? undefined
    : await Actor.createProxyConfiguration({
      useApifyProxy: true,
      groups: ['RESIDENTIAL'],
      checkAccess: false,
    });
  const records = [];
  const summaries = [];

  for (const job of jobs) {
    const competition = getCompetition(job.competition);
    const startedAt = new Date().toISOString();

    await Actor.setStatusMessage(`Resolving ${competition.title} ${job.year}`);
    const seasonResolution = await resolveSeason({
      competition,
      year: job.year,
      proxyConfiguration,
      log,
    });

    await Actor.setStatusMessage(`Enumerating ${competition.title} ${seasonResolution.season}`);
    const { matches, liveFsign } = await enumerateMatches({
      resultsUrl: seasonResolution.resultsUrl,
      competition,
      year: job.year,
      proxyConfiguration,
      log,
    });

    const limit = pLimit(maxConcurrency);
    let withStats = 0;
    let failed = 0;
    const failures = [];

    await Actor.setStatusMessage(`Fetching stats for ${matches.length} ${competition.title} matches`);
    const jobRecords = await Promise.all(matches.map((match) => limit(async () => {
      const feedOptions = {
        proxyConfiguration,
        residentialProxyConfiguration,
        fallbackFsign: liveFsign,
        log,
      };

      try {
        const response = await fetchStats(match.mid, feedOptions);
        const statsByPeriod = response.noStats ? {} : parseStatsFeed(response.body);
        const hasStats = Object.keys(statsByPeriod).length > 0;

        if (hasStats) {
          withStats += 1;
          // Summary feed (HT + regulation FT) is only worth fetching for matches
          // that actually have statistics; failure is non-fatal.
          const summaryResponse = await fetchSummary(match.mid, feedOptions).catch(() => null);
          mergeSummary(match, summaryResponse);
        }

        return {
          competition,
          year: job.year,
          season: seasonResolution.season,
          match,
          statsByPeriod,
          hasStats,
          feed: { host: response.host, proxyTier: response.proxyTier, noStats: response.noStats },
        };
      } catch (error) {
        failed += 1;
        failures.push({ mid: match.mid, matchUrl: match.matchUrl, message: error.message });
        logWarning(log, `Stats fetch failed for ${match.mid}`, { message: error.message });

        return {
          competition,
          year: job.year,
          season: seasonResolution.season,
          match,
          statsByPeriod: {},
          hasStats: false,
          feed: { noStats: true, error: error.message },
        };
      }
    })));

    records.push(...jobRecords);
    summaries.push({
      competition: competition.key,
      title: competition.title,
      year: job.year,
      season: seasonResolution.season,
      resultsUrl: seasonResolution.resultsUrl,
      startedAt,
      finishedAt: new Date().toISOString(),
      matchesFound: matches.length,
      matchesWithStats: withStats,
      matchesWithoutStats: matches.length - withStats - failed,
      statsFailed: failed,
      onlyWithStats,
      failures,
    });
  }

  const outputRecords = onlyWithStats ? records.filter((record) => record.hasStats) : records;
  const rowPlan = createRowPlan(outputRecords, includePeriods);
  const rows = outputRecords.map((record) => buildRow(record, rowPlan));

  if (rows.length) {
    await Actor.pushData(rows);
  }

  const output = {
    generatedAt: new Date().toISOString(),
    jobs: summaries,
    totalRows: rows.length,
    columns: rowPlan.outputFields,
  };

  await Actor.setValue('OUTPUT', output);
  await Actor.setStatusMessage(`Finished: ${rows.length} rows`);
  logInfo(log, 'Run summary', output);
});

// Merge halftime score and regulation full-time score from the match summary
// feed. Summary FT (1st half + 2nd half) is authoritative regulation and
// overrides the listing score, which can show the after-extra-time result.
function mergeSummary(match, summaryResponse) {
  if (!summaryResponse || summaryResponse.noStats) {
    return;
  }

  const summary = parseSummaryFeed(summaryResponse.body);

  if (summary.homeScoreHt !== '') match.homeScoreHt = summary.homeScoreHt;
  if (summary.awayScoreHt !== '') match.awayScoreHt = summary.awayScoreHt;
  if (summary.homeScoreFt !== '') match.homeScoreFt = summary.homeScoreFt;
  if (summary.awayScoreFt !== '') match.awayScoreFt = summary.awayScoreFt;
}
