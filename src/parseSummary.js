import { parseRecord } from './parseStats.js';

const RECORD_SEPARATOR = '~';

/**
 * Parses Flashscore's match summary feed (df_sur_1_{mid}).
 * Score records: BA/BB = 1st-half home/away goals, BC/BD = 2nd-half home/away,
 * RPA/RPB = penalty shootout home/away. Regulation FT = 1st half + 2nd half
 * (extra time and shootouts excluded).
 */
export function parseSummaryFeed(feedBody) {
  const records = String(feedBody ?? '').split(RECORD_SEPARATOR).map(parseRecord);
  const toInt = (value) => (value === undefined || value === '' ? null : Number.parseInt(value, 10));

  let firstHalfHome = null;
  let firstHalfAway = null;
  let secondHalfHome = null;
  let secondHalfAway = null;
  let penaltiesHome = null;
  let penaltiesAway = null;

  for (const record of records) {
    if (record.BA !== undefined) firstHalfHome = toInt(record.BA);
    if (record.BB !== undefined) firstHalfAway = toInt(record.BB);
    if (record.BC !== undefined) secondHalfHome = toInt(record.BC);
    if (record.BD !== undefined) secondHalfAway = toInt(record.BD);
    if (record.RPA !== undefined) penaltiesHome = toInt(record.RPA);
    if (record.RPB !== undefined) penaltiesAway = toInt(record.RPB);
  }

  const regulation = (first, second) => {
    if (first === null && second === null) return '';
    return (first ?? 0) + (second ?? 0);
  };

  return {
    homeScoreHt: firstHalfHome ?? '',
    awayScoreHt: firstHalfAway ?? '',
    homeScoreFt: regulation(firstHalfHome, secondHalfHome),
    awayScoreFt: regulation(firstHalfAway, secondHalfAway),
    homeScorePens: penaltiesHome ?? '',
    awayScorePens: penaltiesAway ?? '',
  };
}
