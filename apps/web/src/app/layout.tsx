import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { ToastProvider } from '@/components/ui/Toast';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#b5463d' },
    { media: '(prefers-color-scheme: dark)', color: '#d6863d' },
  ],
};

export const metadata: Metadata = {
  title: {
    default: '乾坤戒 — Storing',
    template: '%s | 乾坤戒',
  },
  description: 'AI 驱动的个人稍后阅读平台，让你的文章收藏变成真正的知识资产',
  applicationName: '乾坤戒',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '乾坤戒',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: 'website',
    siteName: '乾坤戒',
    title: '乾坤戒 — 你的第二大脑',
    description: 'AI 驱动的个人稍后阅读平台，让你的文章收藏变成真正的知识资产',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
