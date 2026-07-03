import { slugify } from './util.js';

// Canonical map keyed by Flashscore's stable numeric stat id (SD).
// Harvested from live df_st feeds; ids are stable across matches/locales,
// so this is the primary source of truth for column names.
export const STAT_ID_MAP = Object.freeze({
  432: 'expected_goals',
  499: 'xg_on_target',
  12: 'ball_possession',
  34: 'total_shots',
  13: 'shots_on_target',
  14: 'shots_off_target',
  158: 'blocked_shots',
  461: 'shots_inside_box',
  463: 'shots_outside_box',
  457: 'hit_the_woodwork',
  459: 'big_chances',
  16: 'corner_kicks',
  471: 'touches_in_opposition_box',
  521: 'accurate_through_passes',
  17: 'offsides',
  15: 'free_kicks',
  342: 'passes',
  517: 'long_passes',
  467: 'passes_in_final_third',
  433: 'crosses',
  503: 'expected_assists',
  18: 'throw_ins',
  21: 'fouls',
  475: 'tackles',
  513: 'duels_won',
  479: 'clearances',
  434: 'interceptions',
  507: 'errors_leading_to_shot',
  509: 'errors_leading_to_goal',
  19: 'goalkeeper_saves',
  501: 'xgot_faced',
  511: 'goals_prevented',
  23: 'yellow_cards',
});

const LABEL_ALIAS_MAP = Object.freeze({
  accurate_passes: 'passes',
  accurate_crosses: 'crosses',
  accurate_long_balls: 'long_passes',
  accurate_long_passes: 'long_passes',
  ball_possession: 'ball_possession',
  big_chances: 'big_chances',
  blocked_shots: 'blocked_shots',
  clearances: 'clearances',
  corner_kicks: 'corner_kicks',
  crosses: 'crosses',
  duels_won: 'duels_won',
  errors_leading_to_goal: 'errors_leading_to_goal',
  errors_leading_to_shot: 'errors_leading_to_shot',
  expected_assists_xa: 'expected_assists',
  expected_assists: 'expected_assists',
  expected_goals_xg: 'expected_goals',
  expected_goals: 'expected_goals',
  fouls: 'fouls',
  free_kicks: 'free_kicks',
  goalkeeper_saves: 'goalkeeper_saves',
  goals_prevented: 'goals_prevented',
  hit_the_woodwork: 'hit_the_woodwork',
  interceptions: 'interceptions',
  long_balls: 'long_passes',
  long_passes: 'long_passes',
  offsides: 'offsides',
  passes: 'passes',
  passes_in_final_third: 'passes_in_final_third',
  red_cards: 'red_cards',
  shots_blocked: 'blocked_shots',
  shots_inside_box: 'shots_inside_box',
  shots_off_target: 'shots_off_target',
  shots_on_target: 'shots_on_target',
  shots_outside_box: 'shots_outside_box',
  tackles: 'tackles',
  throw_ins: 'throw_ins',
  total_shots: 'total_shots',
  touches_in_opposition_box: 'touches_in_opposition_box',
  xg_on_target_xgot: 'xg_on_target',
  xg_on_target: 'xg_on_target',
  xgot_faced: 'xgot_faced',
  yellow_cards: 'yellow_cards',
});

export const STAT_COLUMN_ORDER = Object.freeze([
  'expected_goals',
  'xg_on_target',
  'ball_possession',
  'total_shots',
  'shots_on_target',
  'shots_off_target',
  'blocked_shots',
  'shots_inside_box',
  'shots_outside_box',
  'hit_the_woodwork',
  'big_chances',
  'corner_kicks',
  'touches_in_opposition_box',
  'accurate_through_passes',
  'offsides',
  'free_kicks',
  'passes',
  'long_passes',
  'passes_in_final_third',
  'crosses',
  'expected_assists',
  'throw_ins',
  'fouls',
  'tackles',
  'duels_won',
  'clearances',
  'interceptions',
  'errors_leading_to_shot',
  'errors_leading_to_goal',
  'goalkeeper_saves',
  'xgot_faced',
  'goals_prevented',
  'yellow_cards',
  'red_cards',
]);

export const RATIO_STAT_COLUMNS = Object.freeze(new Set([
  'passes',
  'long_passes',
  'passes_in_final_third',
  'crosses',
  'tackles',
]));

export function canonicalStatName(stat) {
  const statId = stat?.id == null ? '' : String(stat.id);
  const mappedById = STAT_ID_MAP[statId];

  if (mappedById) {
    return mappedById;
  }

  const labelSlug = slugify(stat?.label || `stat_${statId || 'unknown'}`);
  return LABEL_ALIAS_MAP[labelSlug] || labelSlug;
}

export function sortStatColumns(statColumns) {
  const order = new Map(STAT_COLUMN_ORDER.map((name, index) => [name, index]));

  return [...statColumns].sort((left, right) => {
    const leftIndex = order.has(left) ? order.get(left) : Number.MAX_SAFE_INTEGER;
    const rightIndex = order.has(right) ? order.get(right) : Number.MAX_SAFE_INTEGER;

    if (leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }

    return left.localeCompare(right);
  });
}
