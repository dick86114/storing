// 预设色板（微信风格配色）
const COLOR_PALETTE = [
  { bg: '#e6f7ff', text: '#1890ff' }, // 蓝
  { bg: '#f6ffed', text: '#52c41a' }, // 绿
  { bg: '#fff7e6', text: '#fa8c16' }, // 橙
  { bg: '#f9f0ff', text: '#722ed1' }, // 紫
  { bg: '#fff1f0', text: '#f5222d' }, // 红
  { bg: '#e6fffb', text: '#13c2c2' }, // 青
  { bg: '#fcffe6', text: '#fadb14' }, // 黄
  { bg: '#f0f5ff', text: '#2f54eb' }, // 深蓝
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