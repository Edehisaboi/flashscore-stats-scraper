import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { METADATA_FIELDS, PERIOD_CONFIG } from '../src/buildRow.js';
import { RATIO_STAT_COLUMNS, STAT_COLUMN_ORDER } from '../src/statMap.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const schemaPath = resolve(projectRoot, '.actor', 'dataset_schema.json');

const periods = [PERIOD_CONFIG.ft, PERIOD_CONFIG['1h']];
const fields = [
  ...METADATA_FIELDS,
  ...periods.flatMap((period) => STAT_COLUMN_ORDER.flatMap((statName) => {
    const valueFields = RATIO_STAT_COLUMNS.has(statName)
      ? [`${statName}_pct`, `${statName}_completed`, `${statName}_attempted`]
      : [statName];

    return valueFields.flatMap((valueField) => [
      `home_${valueField}_${period.outputSuffix}`,
      `away_${valueField}_${period.outputSuffix}`,
    ]);
  })),
];

const schema = {
  actorSpecification: 1,
  views: {
    overview: {
      title: 'Overview',
      transformation: {
        fields,
      },
      display: {
        component: 'table',
        properties: {
          match_url: { label: 'Match URL', format: 'link' },
        },
      },
    },
  },
  fields: Object.fromEntries(fields.map((field) => [field, fieldSchema(field)])),
};

await mkdir(dirname(schemaPath), { recursive: true });
await writeFile(schemaPath, `${JSON.stringify(schema, null, 2)}\n`, 'utf8');
console.log(`Wrote ${schemaPath}`);

function fieldSchema(field) {
  if (field.endsWith('_id') || field === 'match_id') {
    return {
      type: 'string',
      title: titleize(field),
    };
  }

  if (field.includes('_score_') || field.match(/_(completed|attempted)_(ft|1h)$/)) {
    return {
      type: ['integer', 'string'],
      title: titleize(field),
    };
  }

  if (field.match(/_(ft|1h)$/) || field.endsWith('_pct_ft') || field.endsWith('_pct_1h')) {
    return {
      type: ['number', 'string'],
      title: titleize(field),
    };
  }

  return {
    type: 'string',
    title: titleize(field),
  };
}

function titleize(field) {
  return field
    .split('_')
    .map((part) => part.toUpperCase() === part ? part : part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
