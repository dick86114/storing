export const CATEGORIES = ['技术', '设计', 'AI', '商业', '职业', '效率'] as const;

export type Category = (typeof CATEGORIES)[number];

export const PER_PAGE = 8;
