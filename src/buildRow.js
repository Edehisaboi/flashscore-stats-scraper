import { FLASH_SCORE_BASE_URL } from './competitions.js';
import { canonicalStatName, RATIO_STAT_COLUMNS, STAT_COLUMN_ORDER, sortStatColumns } from './statMap.js';
import {
  cleanText,
  combineStatValues,
  expandStatValue,
  hasExpandedStatValue,
  parseInteger,
} from './util.js';

export const METADATA_FIELDS = Object.freeze([
  'competition',
  'country',
  'season',
  'match_id',
  'match_url',
  'status',
  'date_utc',
  'kickoff',
  'round',
  'home_team',
  'home_team_id',
  'away_team',
  'away_team_id',
  'home_score_ft',
  'away_score_ft',
  'home_score_ht',
  'away_score_ht',
]);

// Upcoming fixtures have no statistics, so their rows carry metadata only
// (a subset of METADATA_FIELDS, minus the score columns).
export const FIXTURE_FIELDS = Object.freeze([
  'competition',
  'country',
  'season',
  'match_id',
  'match_url',
  'status',
  'date_utc',
  'kickoff',
  'round',
  'home_team',
  'home_team_id',
  'away_team',
  'away_team_id',
]);

export const PERIOD_CONFIG = Object.freeze({
  ft: {
    key: 'ft',
    outputSuffix: 'ft',
    title: 'Full time',
  },
  '1h': {
    key: '1h',
    outputSuffix: '1h',
    title: 'First half',
  },
});

const DEFAULT_INCLUDE_PERIODS = Object.freeze(['ft', '1h']);
const TEAM_KEYS = Object.freeze(['home', 'away']);

export function createRowPlan(records, includePeriods = DEFAULT_INCLUDE_PERIODS) {
  const periods = normalizeIncludePeriods(includePeriods);
  // Seed with the canonical superset so every run yields the same full column
  // set (stable CSV), then add any newly discovered stats on top.
  const statNames = new Set(STAT_COLUMN_ORDER);
  const expandedStats = new Set(RATIO_STAT_COLUMNS);

  for (const record of records) {
    for (const period of periods) {
      const periodStats = getPeriodStatMap(record.statsByPeriod, period.key, record.match);

      for (const [statName, values] of periodStats) {
        statNames.add(statName);

        if (
          RATIO_STAT_COLUMNS.has(statName) ||
          hasExpandedStatValue(values.home) ||
          hasExpandedStatValue(values.away)
        ) {
          expandedStats.add(statName);
        }
      }
    }
  }

  const orderedStatNames = sortStatColumns(statNames);
  const valueFieldsByStat = Object.fromEntries(
    orderedStatNames.map((statName) => [
      statName,
      expandedStats.has(statName)
        ? [`${statName}_pct`, `${statName}_completed`, `${statName}_attempted`]
        : [statName],
    ]),
  );

  const outputFields = [
    ...METADATA_FIELDS,
    ...periods.flatMap((period) => orderedStatNames.flatMap((statName) => (
      valueFieldsByStat[statName].flatMap((valueField) => (
        TEAM_KEYS.map((team) => `${team}_${valueField}_${period.outputSuffix}`)
      ))
    ))),
  ];

  return {
    periods,
    statNames: orderedStatNames,
    expandedStats,
    valueFieldsByStat,
    outputFields,
  };
}

export function buildRow(record, rowPlan) {
  const row = {};

  for (const field of METADATA_FIELDS) {
    row[field] = getMetadataValue(record, field);
  }

  for (const period of rowPlan.periods) {
    const periodStats = getPeriodStatMap(record.statsByPeriod, period.key, record.match);

    for (const statName of rowPlan.statNames) {
      const values = periodStats.get(statName);
      const homeExpanded = expandStatValue(values?.home ?? '', statName, {
        forceExpanded: rowPlan.expandedStats.has(statName),
      });
      const awayExpanded = expandStatValue(values?.away ?? '', statName, {
        forceExpanded: rowPlan.expandedStats.has(statName),
      });

      for (const valueField of rowPlan.valueFieldsByStat[statName]) {
        row[`home_${valueField}_${period.outputSuffix}`] = homeExpanded[valueField] ?? '';
        row[`away_${valueField}_${period.outputSuffix}`] = awayExpanded[valueField] ?? '';
      }
    }
  }

  return row;
}

// Build a metadata-only row for an upcoming fixture. Reuses the same metadata
// resolution as buildRow so field values stay consistent between modes.
export function buildFixtureRow(record) {
  const row = {};

  for (const field of FIXTURE_FIELDS) {
    row[field] = getMetadataValue(record, field);
  }

  return row;
}

export function getPeriodStatMap(statsByPeriod = {}, periodKey, match = {}) {
  if (periodKey === 'ft') {
    return getFullTimeStatMap(statsByPeriod, match);
  }

  if (periodKey === '1h') {
    return createStatMap(findPeriodEntries(statsByPeriod, ['1st Half', 'First Half', '1H']));
  }

  return new Map();
}

export function createStatMap(entries = []) {
  const byName = new Map();

  for (const entry of entries) {
    const statName = canonicalStatName(entry);
    const normalized = {
      id: entry.id || '',
      label: entry.label || statName,
      group: entry.group || '',
      home: cleanText(entry.home),
      away: cleanText(entry.away),
    };
    const existing = byName.get(statName);

    if (!existing) {
      byName.set(statName, normalized);
      continue;
    }

    byName.set(statName, {
      ...existing,
      home: existing.home || normalized.home,
      away: existing.away || normalized.away,
    });
  }

  return byName;
}

function getFullTimeStatMap(statsByPeriod, match) {
  const firstHalf = createStatMap(findPeriodEntries(statsByPeriod, ['1st Half', 'First Half', '1H']));
  const secondHalf = createStatMap(findPeriodEntries(statsByPeriod, ['2nd Half', 'Second Half', '2H']));

  if (hasExtraTime(match, statsByPeriod) && firstHalf.size && secondHalf.size) {
    return combineHalfStatMaps(firstHalf, secondHalf);
  }

  const matchPeriod = createStatMap(findPeriodEntries(statsByPeriod, ['Match', 'Full Time', 'FT']));

  if (matchPeriod.size) {
    return matchPeriod;
  }

  if (firstHalf.size && secondHalf.size) {
    return combineHalfStatMaps(firstHalf, secondHalf);
  }

  return matchPeriod;
}

function combineHalfStatMaps(firstHalf, secondHalf) {
  const names = new Set([...firstHalf.keys(), ...secondHalf.keys()]);
  const combined = new Map();

  for (const statName of names) {
    const first = firstHalf.get(statName);
    const second = secondHalf.get(statName);

    combined.set(statName, {
      id: first?.id || second?.id || '',
      label: first?.label || second?.label || statName,
      group: first?.group || second?.group || '',
      home: combineStatValues(first?.home ?? '', second?.home ?? ''),
      away: combineStatValues(first?.away ?? '', second?.away ?? ''),
    });
  }

  return combined;
}

function findPeriodEntries(statsByPeriod, labels) {
  const normalizedLabels = new Set(labels.map((label) => normalizePeriodName(label)));
  const matchedKey = Object.keys(statsByPeriod || {}).find((period) => normalizedLabels.has(normalizePeriodName(period)));
  return matchedKey ? statsByPeriod[matchedKey] || [] : [];
}

function hasExtraTime(match, statsByPeriod) {
  // Only an actual extra-time stats period means the "Match" block includes ET
  // and we must fall back to 1st+2nd half for regulation. A penalty shootout
  // with no ET leaves the "Match" block at 90', so it is used directly.
  const periodNames = Object.keys(statsByPeriod || {}).join(' ').toLowerCase();

  return /extra/.test(periodNames);
}

function normalizeIncludePeriods(includePeriods) {
  const requested = Array.isArray(includePeriods) && includePeriods.length ? includePeriods : DEFAULT_INCLUDE_PERIODS;
  const unique = [...new Set(requested)];
  const valid = unique
    .map((period) => PERIOD_CONFIG[period])
    .filter(Boolean);

  if (!valid.length) {
    return DEFAULT_INCLUDE_PERIODS.map((period) => PERIOD_CONFIG[period]);
  }

  return DEFAULT_INCLUDE_PERIODS
    .filter((period) => valid.some((item) => item.key === period))
    .map((period) => PERIOD_CONFIG[period]);
}

function getMetadataValue(record, field) {
  const match = record.match || {};
  const competition = record.competition || {};

  switch (field) {
    case 'competition':
      return competition.title || match.competition || '';
    case 'country':
      return competition.country || match.country || '';
    case 'season':
      return record.season || match.season || '';
    case 'match_id':
      return match.mid || match.matchId || '';
    case 'match_url':
      return match.matchUrl || buildFallbackMatchUrl(match.mid || match.matchId);
    case 'status':
      return match.status || '';
    case 'date_utc':
      return match.dateUtc || '';
    case 'kickoff':
      return match.kickoff || match.kickoffText || '';
    case 'round':
      return match.round || '';
    case 'home_team':
      return match.homeTeam || '';
    case 'home_team_id':
      return match.homeTeamId || '';
    case 'away_team':
      return match.awayTeam || '';
    case 'away_team_id':
      return match.awayTeamId || '';
    case 'home_score_ft':
      return parseInteger(match.homeScoreFt);
    case 'away_score_ft':
      return parseInteger(match.awayScoreFt);
    case 'home_score_ht':
      return parseInteger(match.homeScoreHt);
    case 'away_score_ht':
      return parseInteger(match.awayScoreHt);
    default:
      return '';
  }
}

function buildFallbackMatchUrl(mid) {
  return mid ? `${FLASH_SCORE_BASE_URL}/match/${mid}/#/match-summary` : '';
}

function normalizePeriodName(value) {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}
