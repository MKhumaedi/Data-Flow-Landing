import { logger } from '../../lib/logger';
import { SearchResultItem, GroupedSearchResults, SearchResponse } from './search.types';
import { blogService } from '../blog/blog.service';
import { formulaService } from '../formulas/formula.service';
import { formService } from '../forms/form.service';

const STATIC_PAGES: SearchResultItem[] = [
  {
    id: 'page-dashboard',
    category: 'halaman',
    title: 'Dashboard Analyst',
    description: 'Unggah dataset CSV/Excel dan buat visualisasi visual interaktif',
    url: 'upload',
    badge: 'Produk',
    categoryLabel: 'Halaman',
  },
  {
    id: 'page-templates',
    category: 'halaman',
    title: 'Galeri Template Dashboard',
    description: 'Koleksi tema visual dan layout eksekutif siap pakai',
    url: 'templates',
    badge: 'Galeri',
    categoryLabel: 'Halaman',
  },
  {
    id: 'page-rumus',
    category: 'halaman',
    title: 'Katalog Rumus Excel',
    description: 'Pelajari sintaks, contoh, dan latihan interaktif spreadsheet',
    url: 'rumus',
    badge: 'Mastery',
    categoryLabel: 'Halaman',
  },
  {
    id: 'page-formulir',
    category: 'halaman',
    title: 'Formulir & Dokumen Bisnis',
    description: '61 Template dokumen profesional siap ekspor PDF dan Excel',
    url: 'formulir',
    badge: 'Bisnis',
    categoryLabel: 'Halaman',
  },
  {
    id: 'page-cv-ats',
    category: 'halaman',
    title: 'Buat CV ATS-Friendly',
    description: 'Pembuat resume berstandar Applicant Tracking System',
    url: 'buat-cv?gaya=ats',
    badge: 'Karir',
    categoryLabel: 'Halaman',
  },
  {
    id: 'page-cv-kreatif',
    category: 'halaman',
    title: 'Buat CV Kreatif',
    description: 'Format visual modern elegan untuk portofolio dan profil kerja',
    url: 'buat-cv?gaya=kreatif',
    badge: 'Karir',
    categoryLabel: 'Halaman',
  },
  {
    id: 'page-ads',
    category: 'halaman',
    title: 'Pasang Iklan & Sponsorship',
    description: 'Program kemitraan dan penempatan banner bisnis terarah di MayStudio',
    url: 'pasang-iklan',
    badge: 'Partner',
    categoryLabel: 'Halaman',
  },
];

export class SearchService {
  private filterPages(q: string): SearchResultItem[] {
    const term = q.toLowerCase().trim();
    if (!term) return STATIC_PAGES.slice(0, 4);
    return STATIC_PAGES.filter(
      (p) => p.title.toLowerCase().includes(term) || p.description.toLowerCase().includes(term)
    ).slice(0, 4);
  }

  private async searchFormulas(q: string): Promise<SearchResultItem[]> {
    const term = q.toLowerCase().trim();
    try {
      const items = await formulaService.listPublished();
      const filtered = term
        ? items.filter(
            (f) =>
              (f.name && f.name.toLowerCase().includes(term)) ||
              (f.shortDesc && f.shortDesc.toLowerCase().includes(term)) ||
              (f.category && f.category.toLowerCase().includes(term))
          )
        : items;
      return filtered.slice(0, 5).map((f: any) => ({
        id: `rumus-${f.id || f.slug}`,
        category: 'rumus',
        title: f.name,
        description: f.shortDesc || `Kategori ${f.category}`,
        url: `rumus/${f.slug}`,
        badge: f.category,
        categoryLabel: 'Rumus',
      }));
    } catch (e: any) {
      logger.warn(`[SearchService] Formula search failed: ${e.message}`);
      return [];
    }
  }

  private async searchFormTemplates(q: string): Promise<SearchResultItem[]> {
    const term = q.toLowerCase().trim();
    try {
      const items = await formService.listPublished();
      const filtered = term
        ? items.filter(
            (ft) =>
              (ft.title && ft.title.toLowerCase().includes(term)) ||
              (ft.description && ft.description.toLowerCase().includes(term)) ||
              (ft.category && ft.category.toLowerCase().includes(term))
          )
        : items;
      return filtered.slice(0, 5).map((ft: any) => ({
        id: `form-${ft.id || ft.slug}`,
        category: 'formulir',
        title: ft.title,
        description: ft.description || `Formulir Kategori ${ft.category}`,
        url: `formulir/${ft.slug}`,
        badge: ft.category,
        categoryLabel: 'Formulir',
      }));
    } catch (e: any) {
      logger.warn(`[SearchService] FormTemplate search failed: ${e.message}`);
      return [];
    }
  }

  private async searchBlogPosts(q: string): Promise<SearchResultItem[]> {
    const term = q.toLowerCase().trim();
    try {
      const { posts } = await blogService.listPublished({ search: term, limit: 5 });
      return (posts || []).map((b: any) => ({
        id: `blog-${b.id || b.slug}`,
        category: 'blog',
        title: b.title,
        description: b.excerpt || 'Artikel insight bisnis dan tutorial spreadsheet.',
        url: `blog/${b.slug}`,
        badge: b.category,
        categoryLabel: 'Blog',
      }));
    } catch (e: any) {
      logger.warn(`[SearchService] Blog search failed: ${e.message}`);
      return [];
    }
  }

  async search(query: string): Promise<SearchResponse> {
    const [rumus, formulir, blog] = await Promise.all([
      this.searchFormulas(query),
      this.searchFormTemplates(query),
      this.searchBlogPosts(query),
    ]);
    const halaman = this.filterPages(query);

    const totalCount = rumus.length + formulir.length + blog.length + halaman.length;

    return {
      query: query.trim(),
      totalCount,
      results: {
        rumus,
        formulir,
        blog,
        halaman,
      },
    };
  }
}

export const searchService = new SearchService();
