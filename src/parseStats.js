const RECORD_SEPARATOR = '~';
const FIELD_SEPARATOR = '\u00ac';
const KEY_VALUE_SEPARATOR = '\u00f7';

export function parseStatsFeed(feedBody) {
  const periods = {};
  let currentPeriod = null;
  let currentGroup = null;

  for (const rawRecord of String(feedBody ?? '').split(RECORD_SEPARATOR)) {
    const record = parseRecord(rawRecord);

    if (Object.keys(record).length === 0) {
      continue;
    }

    if (record.SE) {
      currentPeriod = record.SE;
      periods[currentPeriod] ??= [];
    }

    if (record.SF) {
      currentGroup = record.SF;
    }

    if (!record.SD && !record.SG) {
      continue;
    }

    if (!currentPeriod) {
      currentPeriod = 'Match';
      periods[currentPeriod] ??= [];
    }

    periods[currentPeriod].push({
      id: record.SD || '',
      label: record.SG || '',
      home: record.SH || '',
      away: record.SI || '',
      group: record.SF || currentGroup || '',
    });
  }

  return periods;
}

export function parseRecord(rawRecord) {
  const fields = {};

  for (const rawField of String(rawRecord ?? '').split(FIELD_SEPARATOR)) {
    const index = rawField.indexOf(KEY_VALUE_SEPARATOR);

    if (index === -1) {
      continue;
    }

    const key = rawField.slice(0, index);
    const value = rawField.slice(index + KEY_VALUE_SEPARATOR.length);

    if (key) {
      fields[key] = value;
    }
  }

  return fields;
}
