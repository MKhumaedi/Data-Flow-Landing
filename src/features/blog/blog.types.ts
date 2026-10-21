export type PostStatus = 'DRAFT' | 'PUBLISHED';

export interface BlogPostItem {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  contentMarkdown: string;
  coverImageUrl?: string | null;
  coverImageCredit?: string | null;
  category: string;
  tags: string[];
  authorName: string;
  status: PostStatus;
  publishedAt: Date | string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  viewCount: number;
  createdAt: Date | string;
  updatedAt: Date | string;
  deletedAt?: Date | string | null;
}

export interface CreateBlogPostDto {
  title: string;
  slug?: string;
  excerpt: string;
  contentMarkdown: string;
  coverImageUrl?: string | null;
  coverImageCredit?: string | null;
  category: string;
  tags?: string[];
  authorName?: string;
  status?: PostStatus;
  publishedAt?: string | Date | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
}

export interface UpdateBlogPostDto {
  title?: string;
  slug?: string;
  excerpt?: string;
  contentMarkdown?: string;
  coverImageUrl?: string | null;
  coverImageCredit?: string | null;
  category?: string;
  tags?: string[];
  authorName?: string;
  status?: PostStatus;
  publishedAt?: string | Date | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
}

export interface BlogListQuery {
  category?: string;
  tag?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface BlogAdminStats {
  total: number;
  published: number;
  draft: number;
  deleted: number;
  totalViews: number;
}

export interface AdminBlogListQuery extends BlogListQuery {
  status?: string;
  includeDeleted?: boolean;
}
