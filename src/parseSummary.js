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

/**
 * Merge halftime and regulation full-time scores from the summary feed into a
 * match. Summary FT (1st half + 2nd half) is authoritative regulation and
 * overrides a listing score, which can show the after-extra-time result.
 */
export function mergeSummary(match, summaryResponse) {
  if (!summaryResponse || summaryResponse.noStats) {
    return match;
  }

  const summary = parseSummaryFeed(summaryResponse.body);

  if (summary.homeScoreHt !== '') match.homeScoreHt = summary.homeScoreHt;
  if (summary.awayScoreHt !== '') match.awayScoreHt = summary.awayScoreHt;
  if (summary.homeScoreFt !== '') match.homeScoreFt = summary.homeScoreFt;
  if (summary.awayScoreFt !== '') match.awayScoreFt = summary.awayScoreFt;

  return match;
}

/**
 * Status for a match scraped without its competition listing.
 *
 * fetch_stats addresses matches by id, so there is no listing row to read a
 * status from. A regulation full-time score is the only evidence available that
 * the match was played to a finish, and it only exists once the summary feed
 * reported both halves. Anything else stays empty — deliberately not guessed —
 * so a caller treats it as "no result yet" and retries, rather than promoting a
 * match that was postponed or has not kicked off.
 */
export function deriveMatchStatus(match = {}) {
  const played = (value) => value !== undefined && value !== null && value !== '';
  return played(match.homeScoreFt) && played(match.awayScoreFt) ? 'finished' : '';
}
