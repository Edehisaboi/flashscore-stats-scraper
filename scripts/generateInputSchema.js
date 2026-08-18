import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMPETITIONS } from '../src/competitions.js';
import { MODES } from '../src/input.js';

/**
 * Generates .actor/input_schema.json from the competition catalog.
 *
 * The competition list appears in three separate enums in the schema. Hand-kept
 * they drift from src/competitions.js and from each other — one of the three had
 * enumTitles and the others did not. Deriving all three from the same source
 * makes that impossible.
 *
 * Run: npm run schema:input
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const schemaPath = resolve(projectRoot, '.actor', 'input_schema.json');

const keys = COMPETITIONS.map((competition) => competition.key);
const titles = COMPETITIONS.map((competition) => competition.title);

/** A competition dropdown. `withAll` adds the "every competition" sentinel. */
const competitionEnum = ({ withAll = false } = {}) => ({
  enum: withAll ? ['all', ...keys] : keys,
  enumTitles: withAll ? ['All supported competitions', ...titles] : titles,
});

const schema = {
  title: 'Flashscore Match Stats Scraper',
  type: 'object',
  schemaVersion: 1,
  properties: {
    mode: {
      title: 'Mode',
      type: 'string',
      description: [
        'What this run does. Each mode reads its own section below and ignores the others.',
        '',
        `**${MODES[1]}** — a whole season of finished matches with statistics, for backfill. Reads *Season backfill*.`,
        `**${MODES[0]}** — upcoming matches, metadata only. Reads *Upcoming fixtures*.`,
        `**${MODES[2]}** — statistics for specific matches you already have ids for. Reads *Match statistics*.`,
      ].join('\n'),
      editor: 'select',
      default: 'season_stats',
      enum: ['season_stats', 'fixtures', 'fetch_stats'],
      enumTitles: [
        'Season backfill (competition + year)',
        'Upcoming fixtures (metadata only)',
        'Match statistics (by match id)',
      ],
      sectionCaption: 'Mode',
      sectionDescription: 'Pick what this run should do, then fill in only that mode\'s section.',
    },

    competitions: {
      title: 'Competitions',
      type: 'array',
      description: 'Competitions to scrape upcoming fixtures for. Use "all" for every supported competition.',
      editor: 'select',
      default: ['premier_league'],
      items: { type: 'string', ...competitionEnum({ withAll: true }) },
      uniqueItems: true,
      sectionCaption: 'Upcoming fixtures',
      sectionDescription: 'Used by the fixtures mode only.',
    },
    windowDays: {
      title: 'Window (days)',
      type: 'integer',
      description: 'How many days ahead to include upcoming fixtures.',
      default: 7,
      minimum: 1,
      maximum: 30,
    },

    matchIds: {
      title: 'Match IDs',
      type: 'array',
      description: [
        'Flashscore match ids to fetch statistics for, e.g. `Ug3NfA9d`.',
        'These are the `match_id` values from a previous fixtures run.',
        'Season resolution and match enumeration are skipped entirely, so this is the cheap way to grade a known set of matches.',
      ].join(' '),
      editor: 'stringList',
      prefill: [],
      uniqueItems: true,
      sectionCaption: 'Match statistics',
      sectionDescription: 'Used by the fetch_stats mode only.',
    },

    jobs: {
      title: 'Jobs',
      type: 'array',
      description: [
        'Competition/year pairs to back-fill.',
        'When set, this takes precedence over the single Competition and Year fields below.',
        'For season competitions the year is the start year, so 2024 means 2024/2025.',
      ].join(' '),
      editor: 'json',
      sectionCaption: 'Season backfill',
      sectionDescription: 'Used by the season_stats mode only. Set either Jobs, or the single Competition and Year pair.',
      items: {
        type: 'object',
        required: ['competition', 'year'],
        properties: {
          competition: {
            title: 'Competition',
            description: 'Competition key to scrape.',
            type: 'string',
            ...competitionEnum(),
          },
          year: {
            title: 'Year',
            description: 'Season start year for season competitions, or edition year for calendar competitions.',
            type: 'integer',
            minimum: 1900,
            maximum: 2100,
          },
        },
      },
    },
    competition: {
      title: 'Competition',
      type: 'string',
      description: 'Convenience selector for a single-season run. Ignored when Jobs is set.',
      editor: 'select',
      default: 'premier_league',
      ...competitionEnum(),
    },
    year: {
      title: 'Year',
      type: 'integer',
      description: 'Season start year for season competitions (2024 resolves to 2024/2025), or the edition year for calendar competitions.',
      default: 2024,
      minimum: 1900,
      maximum: 2100,
    },

    proxyConfiguration: {
      title: 'Proxy configuration',
      type: 'object',
      description: 'Datacenter proxy is used first. Individual feed requests escalate to residential proxy only after block detection.',
      editor: 'proxy',
      default: {
        useApifyProxy: true,
        apifyProxyGroups: ['BUYPROXIES94952'],
      },
      sectionCaption: 'Advanced',
      sectionDescription: 'Applies to every mode. The defaults are sensible; change them only if a run is being blocked or is too slow.',
    },
    maxConcurrency: {
      title: 'Max feed concurrency',
      type: 'integer',
      description: 'Maximum concurrent plain HTTP stats-feed requests.',
      default: 10,
      minimum: 1,
      maximum: 50,
    },
    includePeriods: {
      title: 'Periods',
      type: 'array',
      description: 'Periods to include in the output. FT is regulation full time; extra time and penalties are excluded.',
      editor: 'select',
      default: ['ft', '1h'],
      items: {
        type: 'string',
        enum: ['ft', '1h'],
        enumTitles: ['Full time', 'First half'],
      },
      uniqueItems: true,
    },
    onlyWithStats: {
      title: 'Only matches with statistics',
      type: 'boolean',
      description: 'Drop matches that have no statistics (e.g. early cup qualifying rounds). Disable to keep every match, including metadata-only rows.',
      default: true,
    },
  },
};

await mkdir(dirname(schemaPath), { recursive: true });
await writeFile(schemaPath, `${JSON.stringify(schema, null, 2)}\n`, 'utf8');
console.log(`Wrote ${schemaPath} (${keys.length} competitions)`);
