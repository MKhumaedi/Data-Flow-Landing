import { FormulaItem } from './formula.types';
import { LOGICAL_SEEDS } from './seeds/logical.seed';
import { LOOKUP_SEEDS } from './seeds/lookup.seed';
import { MATH_SEEDS } from './seeds/math.seed';
import { TEXT_SEEDS } from './seeds/text.seed';
import { STATISTICAL_SEEDS } from './seeds/statistical.seed';
import { DATETIME_SEEDS } from './seeds/datetime.seed';
import { FINANCIAL_ENG_SEEDS } from './seeds/financial-eng.seed';

export {
  LOGICAL_SEEDS,
  LOOKUP_SEEDS,
  MATH_SEEDS,
  TEXT_SEEDS,
  STATISTICAL_SEEDS,
  DATETIME_SEEDS,
  FINANCIAL_ENG_SEEDS,
};

export const INITIAL_FORMULA_SEEDS: FormulaItem[] = [
  ...LOGICAL_SEEDS,
  ...LOOKUP_SEEDS,
  ...MATH_SEEDS,
  ...TEXT_SEEDS,
  ...STATISTICAL_SEEDS,
  ...DATETIME_SEEDS,
  ...FINANCIAL_ENG_SEEDS,
];
