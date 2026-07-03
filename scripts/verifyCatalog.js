import { Actor, log } from 'apify';
import { COMPETITIONS } from '../src/competitions.js';
import { normalizeProxyConfiguration } from '../src/input.js';
import { resolveSeason } from '../src/resolveSeason.js';

await Actor.main(async () => {
  const input = await Actor.getInput() || {};
  const year = Number(input.year ?? 2024);
  const proxyConfiguration = await Actor.createProxyConfiguration(
    normalizeProxyConfiguration(input.proxyConfiguration || {
      useApifyProxy: true,
      apifyProxyGroups: ['BUYPROXIES94952'],
    }),
  );
  const results = [];

  for (const competition of COMPETITIONS) {
    try {
      const resolved = await resolveSeason({
        competition,
        year,
        proxyConfiguration,
        log,
      });

      results.push({
        competition: competition.key,
        title: competition.title,
        ok: true,
        season: resolved.season,
        resultsUrl: resolved.resultsUrl,
      });
    } catch (error) {
      results.push({
        competition: competition.key,
        title: competition.title,
        ok: false,
        message: error.message,
      });
    }
  }

  await Actor.setValue('OUTPUT', {
    checkedAt: new Date().toISOString(),
    year,
    results,
  });
  await Actor.pushData(results);
});
