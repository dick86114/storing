import type { Metadata } from 'next';
import { LoginScreen } from '@/components/auth/LoginScreen';

export const metadata: Metadata = {
  title: '登录',
  description: '登录乾坤戒，收藏文章由 AI 自动摘要、分类与打标签',
};

export default function LoginPage() {
  return <LoginScreen />;
}
