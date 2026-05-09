// 根据分类名称动态生成颜色
// 使用 hash 算法确保同一分类始终显示相同颜色

// 简单字符串 hash，返回 0-360 的数值用于色相
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash) % 360;
}

// 根据分类名称生成 oklch 颜色
export function getCategoryColor(category: string): { bg: string; text: string } {
  const hue = hashString(category);

  // 背景用高亮度低饱和度，文字用中等亮度较高饱和度
  return {
    bg: `oklch(0.95 0.03 ${hue})`,
    text: `oklch(0.55 0.15 ${hue})`,
  };
}