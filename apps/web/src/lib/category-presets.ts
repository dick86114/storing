export const CATEGORY_COLORS = [
  '#2F6A4F', '#3E7C83', '#536CCB', '#8A5A9E', '#B36A45', '#A67C38',
  '#647B4D', '#2F7780', '#6675B7', '#A16078', '#9B7250', '#6B7088',
];

export function stableCategoryColor(name: string): string {
  let hash = 0;
  for (const char of name.trim()) hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  return CATEGORY_COLORS[hash % CATEGORY_COLORS.length];
}
