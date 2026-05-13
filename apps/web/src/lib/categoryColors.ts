// 预设色板（荧光风格配色，高饱和度）
const COLOR_PALETTE = [
  { bg: 'oklch(92% 0.15 240)', text: 'oklch(65% 0.20 240)' }, // 蓝色荧光
  { bg: 'oklch(93% 0.15 140)', text: 'oklch(65% 0.20 140)' }, // 绿色荧光
  { bg: 'oklch(92% 0.15 60)', text: 'oklch(68% 0.18 60)' },   // 橙色荧光
  { bg: 'oklch(91% 0.15 300)', text: 'oklch(60% 0.22 300)' }, // 紫色荧光
  { bg: 'oklch(91% 0.15 20)', text: 'oklch(60% 0.22 20)' },   // 红色荧光
  { bg: 'oklch(93% 0.12 180)', text: 'oklch(60% 0.18 180)' }, // 青色荧光
  { bg: 'oklch(94% 0.14 95)', text: 'oklch(75% 0.18 95)' },   // 黄色荧光
  { bg: 'oklch(90% 0.15 255)', text: 'oklch(55% 0.25 255)' }, // 深蓝荧光
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