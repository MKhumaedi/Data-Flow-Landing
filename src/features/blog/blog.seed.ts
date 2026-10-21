import { BlogPostItem } from './blog.types';
import { EXCEL_DATA_SEEDS } from './seeds/excel-data.seed';
import { CAREER_CV_SEEDS } from './seeds/career-cv.seed';
import { BUSINESS_ADMIN_SEEDS } from './seeds/business-admin.seed';
import { PRODUCT_GUIDE_SEEDS } from './seeds/product-guide.seed';

export const INITIAL_BLOG_SEEDS: BlogPostItem[] = [
  ...EXCEL_DATA_SEEDS,
  ...CAREER_CV_SEEDS,
  ...BUSINESS_ADMIN_SEEDS,
  ...PRODUCT_GUIDE_SEEDS,
];
