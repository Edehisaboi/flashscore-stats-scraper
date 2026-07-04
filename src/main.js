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
    let scraped = 0;
    let failed = 0;
    const failures = [];

    await Actor.setStatusMessage(`Fetching stats for ${matches.length} ${competition.title} matches`);
    const jobRecords = await Promise.all(matches.map((match) => limit(async () => {
      try {
        const feedOptions = {
          proxyConfiguration,
          residentialProxyConfiguration,
          fallbackFsign: liveFsign,
          log,
        };
        const [response, summaryResponse] = await Promise.all([
          fetchStats(match.mid, feedOptions),
          // Summary feed provides HT score + regulation FT; failure is non-fatal.
          fetchSummary(match.mid, feedOptions).catch(() => null),
        ]);
        const statsByPeriod = response.noStats ? {} : parseStatsFeed(response.body);
        mergeSummary(match, summaryResponse);
        scraped += 1;

        return {
          competition,
          year: job.year,
          season: seasonResolution.season,
          match,
          statsByPeriod,
          feed: {
            host: response.host,
            proxyTier: response.proxyTier,
            noStats: response.noStats,
          },
        };
      } catch (error) {
        failed += 1;
        failures.push({
          mid: match.mid,
          matchUrl: match.matchUrl,
          message: error.message,
        });
        logWarning(log, `Stats fetch failed for ${match.mid}; emitting metadata-only row`, {
          message: error.message,
        });

        return {
          competition,
          year: job.year,
          season: seasonResolution.season,
          match,
          statsByPeriod: {},
          feed: {
            noStats: true,
            error: error.message,
          },
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
      rowsPrepared: jobRecords.length,
      statsFetched: scraped,
      statsFailed: failed,
      failures,
    });
  }

  const rowPlan = createRowPlan(records, includePeriods);
  const rows = records.map((record) => buildRow(record, rowPlan));

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
