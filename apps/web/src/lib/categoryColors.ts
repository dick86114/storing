// 预设色板（高级荧光配色，低饱和度背景 + 高饱和度文字）
const COLOR_PALETTE = [
  { bg: 'oklch(94% 0.03 240)', text: 'oklch(55% 0.15 240)' }, // 蓝
  { bg: 'oklch(94% 0.03 140)', text: 'oklch(55% 0.15 140)' }, // 绿
  { bg: 'oklch(93% 0.03 55)', text: 'oklch(58% 0.14 55)' },   // 橙
  { bg: 'oklch(93% 0.03 300)', text: 'oklch(50% 0.16 300)' }, // 紫
  { bg: 'oklch(93% 0.03 15)', text: 'oklch(50% 0.16 15)' },   // 红
  { bg: 'oklch(94% 0.02 180)', text: 'oklch(50% 0.14 180)' }, // 青
  { bg: 'oklch(95% 0.03 90)', text: 'oklch(70% 0.15 90)' },   // 黄
  { bg: 'oklch(92% 0.04 255)', text: 'oklch(45% 0.18 255)' }, // 深蓝
];

// 分类名称到颜色的映射缓存
const categoryColorMap: Record<string, { bg: string; text: string }> = {};
let colorIndex = 0;

export function getCategoryColor(category: string): { bg: string; text: string } {
  if (categoryColorMap[category]) {
    return categoryColorMap[category];
  }

  // 从色板中依次分配颜色
  const color = COLOR_PALETTE[colorIndex % COLOR_PALETTE.length];
  colorIndex++;

  categoryColorMap[category] = color;
  return color;
}

// 重置颜色分配（用于测试）
export function resetCategoryColors(): void {
  colorIndex = 0;
  Object.keys(categoryColorMap).forEach(key => delete categoryColorMap[key]);
}