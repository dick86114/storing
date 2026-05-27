export interface Article {
  id: number;
  title: string | null;
  author: string | null;
  source: string | null;
  originalUrl: string | null;
  publishTime: string | null;
  contentMarkdown: string | null;
  contentHtml: string | null;
  coverImage: string | null;
  summary: string | null;
  commentary: string | null;
  tags: string[] | null;
  readStatus: string | null;
  createdAt: string | null;
  // 来自 article_metadata
  isFavorited: boolean;
  isArchived: boolean;
  aiSummary: string | null;
  aiCategory: string | null;
  aiTags: string[];
}

// 列表项简化版本（API 列表接口返回）
export interface ArticleListItem {
  id: number;
  title: string;
  author: string | null;
  source: string;
  publishTime: string | null;
  createdAt: string;
  favoritedAt?: string | null;
  archivedAt?: string | null;
  summary: string;
  aiTags: string[];
  aiCategory?: string | null;  // AI 分类
  isFavorited: boolean;
  isArchived?: boolean;
  coverImage?: string | null;  // 封面图 URL（可选）
}

export interface PaginatedResponse<T> {
  articles: T[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export interface CategoryCount {
  category: string;
  count: number;
}

export type ViewType = 'inbox' | 'favorites' | 'archive';
