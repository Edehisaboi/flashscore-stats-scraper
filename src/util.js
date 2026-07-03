const COMBINED_VALUE_RE = /^(-?\d+(?:[.,]\d+)?)%\s*\((\d+)\s*\/\s*(\d+)\)$/;
const PERCENT_VALUE_RE = /^(-?\d+(?:[.,]\d+)?)%$/;
const FRACTION_VALUE_RE = /^(\d+)\s*\/\s*(\d+)$/;
const NUMERIC_VALUE_RE = /^-?\d+(?:[.,]\d+)?$/;

export function slugify(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'unknown';
}

export function cleanText(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function parseInteger(value) {
  const normalized = String(value ?? '').replace(/[^\d-]/g, '');
  return normalized ? Number.parseInt(normalized, 10) : '';
}

export function parseNumeric(value) {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  const normalized = String(value).replace(/,/g, '');
  return NUMERIC_VALUE_RE.test(normalized) ? Number(normalized) : '';
}

export function parseStatValue(rawValue) {
  const value = cleanText(rawValue);

  if (!value || value === '-' || value.toLowerCase() === 'n/a') {
    return { kind: 'blank', raw: '' };
  }

  const combined = value.match(COMBINED_VALUE_RE);
  if (combined) {
    return {
      kind: 'combined',
      raw: value,
      pct: Number(combined[1].replace(',', '.')),
      completed: Number.parseInt(combined[2], 10),
      attempted: Number.parseInt(combined[3], 10),
    };
  }

  const percent = value.match(PERCENT_VALUE_RE);
  if (percent) {
    return {
      kind: 'percent',
      raw: value,
      value: Number(percent[1].replace(',', '.')),
    };
  }

  const fraction = value.match(FRACTION_VALUE_RE);
  if (fraction) {
    return {
      kind: 'fraction',
      raw: value,
      completed: Number.parseInt(fraction[1], 10),
      attempted: Number.parseInt(fraction[2], 10),
    };
  }

  const numeric = parseNumeric(value);
  if (numeric !== '') {
    return {
      kind: 'number',
      raw: value,
      value: numeric,
      decimals: decimalPlaces(value),
    };
  }

  return {
    kind: 'text',
    raw: value,
    value,
  };
}

export function hasExpandedStatValue(rawValue) {
  const parsed = parseStatValue(rawValue);
  return parsed.kind === 'combined' || parsed.kind === 'fraction';
}

export function expandStatValue(rawValue, statName, options = {}) {
  const parsed = parseStatValue(rawValue);
  const forceExpanded = options.forceExpanded === true;

  if (parsed.kind === 'blank') {
    return {};
  }

  if (parsed.kind === 'combined') {
    return {
      [`${statName}_pct`]: parsed.pct,
      [`${statName}_completed`]: parsed.completed,
      [`${statName}_attempted`]: parsed.attempted,
    };
  }

  if (parsed.kind === 'fraction') {
    return {
      [`${statName}_pct`]: parsed.attempted > 0 ? roundNumber((parsed.completed / parsed.attempted) * 100, 1) : '',
      [`${statName}_completed`]: parsed.completed,
      [`${statName}_attempted`]: parsed.attempted,
    };
  }

  if (forceExpanded && parsed.kind === 'percent') {
    return {
      [`${statName}_pct`]: parsed.value,
      [`${statName}_completed`]: '',
      [`${statName}_attempted`]: '',
    };
  }

  if (parsed.kind === 'percent' || parsed.kind === 'number') {
    return { [statName]: parsed.value };
  }

  return { [statName]: parsed.value };
}

export function combineStatValues(firstRawValue, secondRawValue) {
  const first = parseStatValue(firstRawValue);
  const second = parseStatValue(secondRawValue);

  if (first.kind === 'blank') {
    return second.raw;
  }

  if (second.kind === 'blank') {
    return first.raw;
  }

  if (isRatioLike(first) && isRatioLike(second)) {
    const completed = first.completed + second.completed;
    const attempted = first.attempted + second.attempted;
    const pct = attempted > 0 ? roundNumber((completed / attempted) * 100, 1) : '';
    return pct === '' ? `${completed}/${attempted}` : `${pct}% (${completed}/${attempted})`;
  }

  if (first.kind === 'percent' && second.kind === 'percent') {
    return `${roundNumber((first.value + second.value) / 2, 1)}%`;
  }

  if (first.kind === 'number' && second.kind === 'number') {
    const decimals = Math.max(first.decimals, second.decimals);
    return String(roundNumber(first.value + second.value, Math.min(decimals, 3)));
  }

  return second.raw || first.raw;
}

export function roundNumber(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

export function parseFlashscoreKickoff(kickoffText, competition, year) {
  // Handles both the results-listing date form "25.05.2025" (DD.MM.YYYY, no
  // time) and the fixtures form "25.05. 16:00" (DD.MM. with time, no year).
  const match = cleanText(kickoffText).match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})?\s*(?:(\d{1,2}):(\d{2}))?/);

  if (!match) {
    return '';
  }

  const day = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const explicitYear = match[3] ? Number.parseInt(match[3], 10) : null;
  const hour = match[4] != null ? Number.parseInt(match[4], 10) : 0;
  const minute = match[5] != null ? Number.parseInt(match[5], 10) : 0;
  const inferredYear = explicitYear ?? (competition.seasonType === 'season' && month < 7 ? year + 1 : year);

  return new Date(Date.UTC(inferredYear, month - 1, day, hour, minute)).toISOString();
}

export function logInfo(log, message, data) {
  if (log?.info) {
    log.info(message, data);
    return;
  }

  if (data === undefined) {
    console.log(message);
  } else {
    console.log(message, data);
  }
}

export function logWarning(log, message, data) {
  if (log?.warning) {
    log.warning(message, data);
    return;
  }

  if (log?.warn) {
    log.warn(message, data);
    return;
  }

  if (data === undefined) {
    console.warn(message);
  } else {
    console.warn(message, data);
  }
}

function isRatioLike(value) {
  return value.kind === 'combined' || value.kind === 'fraction';
}

function decimalPlaces(value) {
  const decimal = String(value).replace(',', '.').split('.')[1];
  return decimal ? decimal.length : 0;
}
