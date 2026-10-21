import { FormTemplateItem } from '../form.types';
import { HR_FORM_SEEDS } from './hr.seed';
import { FINANCE_FORM_SEEDS } from './finance.seed';
import { SALES_FORM_SEEDS } from './sales.seed';
import { WAREHOUSE_FORM_SEEDS } from './warehouse.seed';
import { OPS_FORM_SEEDS } from './ops.seed';
import { HSE_IT_FORM_SEEDS } from './hse_it.seed';

export const ALL_FORM_SEEDS: FormTemplateItem[] = [
  ...HR_FORM_SEEDS,
  ...FINANCE_FORM_SEEDS,
  ...SALES_FORM_SEEDS,
  ...WAREHOUSE_FORM_SEEDS,
  ...OPS_FORM_SEEDS,
  ...HSE_IT_FORM_SEEDS,
];
