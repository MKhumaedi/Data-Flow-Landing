export type SearchCategory = 'rumus' | 'formulir' | 'blog' | 'halaman';

export interface SearchResultItem {
  id: string;
  category: SearchCategory;
  title: string;
  description: string;
  url: string;
  badge?: string;
  categoryLabel?: string;
}

export interface GroupedSearchResults {
  rumus: SearchResultItem[];
  formulir: SearchResultItem[];
  blog: SearchResultItem[];
  halaman: SearchResultItem[];
}

export interface SearchResponse {
  query: string;
  totalCount: number;
  results: GroupedSearchResults;
}
