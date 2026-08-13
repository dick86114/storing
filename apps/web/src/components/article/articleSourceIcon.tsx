'use client';

import type { ComponentType, CSSProperties } from 'react';
import {
  AlibabaOutlined,
  AliyunOutlined,
  AppstoreOutlined,
  BilibiliOutlined,
  BookOutlined,
  ChromeOutlined,
  CodeOutlined,
  DingdingOutlined,
  FileTextOutlined,
  GithubOutlined,
  GitlabOutlined,
  GlobalOutlined,
  QqOutlined,
  ReadOutlined,
  ShoppingOutlined,
  TaobaoCircleOutlined,
  TikTokOutlined,
  WechatOutlined,
  WeiboOutlined,
  XOutlined,
  YoutubeOutlined,
  YuqueOutlined,
  ZhihuOutlined,
} from '@ant-design/icons';

type SourceIconComponent = ComponentType<{
  'aria-hidden'?: boolean | 'true' | 'false';
  className?: string;
  style?: CSSProperties;
}>;

export type ArticleSourceKind =
  | 'wechat'
  | 'douyin'
  | 'xiaohongshu'
  | 'smzdm'
  | 'tencent'
  | 'alibaba'
  | 'aliyun'
  | 'taobao'
  | 'bilibili'
  | 'zhihu'
  | 'weibo'
  | 'yuque'
  | 'github'
  | 'gitlab'
  | 'juejin'
  | 'csdn'
  | 'sspai'
  | 'ithome'
  | '36kr'
  | 'toutiao'
  | 'baidu'
  | 'netease'
  | 'qq'
  | 'dingtalk'
  | 'youtube'
  | 'twitter'
  | 'chrome'
  | 'web';

export type ArticleSourceIcon = {
  kind: ArticleSourceKind;
  label: string;
  titlePrefix: string;
  Icon: SourceIconComponent;
  color: string;
};

type SourceIconRule = ArticleSourceIcon & {
  pattern: RegExp;
};

const SOURCE_ICON_RULES: SourceIconRule[] = [
  {
    kind: 'wechat',
    label: '微信',
    titlePrefix: '微信来源',
    Icon: WechatOutlined,
    color: 'var(--accent)',
    pattern: /mp\.weixin\.qq\.com|weixin\.qq\.com|微信|公众号/i,
  },
  {
    kind: 'douyin',
    label: '抖音',
    titlePrefix: '抖音来源',
    Icon: TikTokOutlined,
    color: 'oklch(0.55 0.23 23)',
    pattern: /douyin\.com|iesdouyin|抖音|tiktok/i,
  },
  {
    kind: 'xiaohongshu',
    label: '小红书',
    titlePrefix: '小红书来源',
    Icon: BookOutlined,
    color: 'oklch(0.58 0.22 25)',
    pattern: /xiaohongshu\.com|xhslink\.com|小红书|rednote|xhs/i,
  },
  {
    kind: 'smzdm',
    label: '什么值得买',
    titlePrefix: '什么值得买来源',
    Icon: ShoppingOutlined,
    color: 'oklch(0.56 0.18 252)',
    pattern: /smzdm\.com|什么值得买|值得买/i,
  },
  {
    kind: 'tencent',
    label: '腾讯',
    titlePrefix: '腾讯来源',
    Icon: QqOutlined,
    color: 'oklch(0.58 0.18 250)',
    pattern: /cloud\.tencent\.com|qq\.com|tencent|腾讯|企鹅号/i,
  },
  {
    kind: 'aliyun',
    label: '阿里云',
    titlePrefix: '阿里云来源',
    Icon: AliyunOutlined,
    color: 'oklch(0.63 0.2 50)',
    pattern: /aliyun\.com|developer\.aliyun\.com|阿里云/i,
  },
  {
    kind: 'alibaba',
    label: '阿里',
    titlePrefix: '阿里来源',
    Icon: AlibabaOutlined,
    color: 'oklch(0.63 0.2 50)',
    pattern: /alibaba\.com|1688\.com|阿里巴巴|阿里/i,
  },
  {
    kind: 'taobao',
    label: '淘宝',
    titlePrefix: '淘宝来源',
    Icon: TaobaoCircleOutlined,
    color: 'oklch(0.63 0.2 50)',
    pattern: /taobao\.com|tmall\.com|淘宝|天猫/i,
  },
  {
    kind: 'bilibili',
    label: 'B站',
    titlePrefix: 'B站来源',
    Icon: BilibiliOutlined,
    color: 'oklch(0.68 0.15 220)',
    pattern: /bilibili\.com|b23\.tv|哔哩|bilibili|b站/i,
  },
  {
    kind: 'zhihu',
    label: '知乎',
    titlePrefix: '知乎来源',
    Icon: ZhihuOutlined,
    color: 'oklch(0.55 0.2 255)',
    pattern: /zhihu\.com|知乎/i,
  },
  {
    kind: 'weibo',
    label: '微博',
    titlePrefix: '微博来源',
    Icon: WeiboOutlined,
    color: 'oklch(0.58 0.2 35)',
    pattern: /weibo\.com|微博/i,
  },
  {
    kind: 'yuque',
    label: '语雀',
    titlePrefix: '语雀来源',
    Icon: YuqueOutlined,
    color: 'oklch(0.57 0.15 150)',
    pattern: /yuque\.com|语雀/i,
  },
  {
    kind: 'github',
    label: 'GitHub',
    titlePrefix: 'GitHub 来源',
    Icon: GithubOutlined,
    color: 'var(--text-muted)',
    pattern: /github\.com|github/i,
  },
  {
    kind: 'gitlab',
    label: 'GitLab',
    titlePrefix: 'GitLab 来源',
    Icon: GitlabOutlined,
    color: 'oklch(0.62 0.16 45)',
    pattern: /gitlab\.com|gitlab/i,
  },
  {
    kind: 'juejin',
    label: '掘金',
    titlePrefix: '掘金来源',
    Icon: CodeOutlined,
    color: 'oklch(0.56 0.2 252)',
    pattern: /juejin\.cn|掘金/i,
  },
  {
    kind: 'csdn',
    label: 'CSDN',
    titlePrefix: 'CSDN 来源',
    Icon: CodeOutlined,
    color: 'oklch(0.56 0.2 25)',
    pattern: /csdn\.net|csdn/i,
  },
  {
    kind: 'sspai',
    label: '少数派',
    titlePrefix: '少数派来源',
    Icon: ReadOutlined,
    color: 'oklch(0.58 0.22 25)',
    pattern: /sspai\.com|少数派/i,
  },
  {
    kind: 'ithome',
    label: 'IT之家',
    titlePrefix: 'IT之家来源',
    Icon: AppstoreOutlined,
    color: 'oklch(0.55 0.18 250)',
    pattern: /ithome\.com|it之家/i,
  },
  {
    kind: '36kr',
    label: '36氪',
    titlePrefix: '36氪来源',
    Icon: FileTextOutlined,
    color: 'oklch(0.55 0.17 250)',
    pattern: /36kr\.com|36氪/i,
  },
  {
    kind: 'toutiao',
    label: '头条',
    titlePrefix: '头条来源',
    Icon: FileTextOutlined,
    color: 'oklch(0.58 0.2 30)',
    pattern: /toutiao\.com|今日头条|头条/i,
  },
  {
    kind: 'baidu',
    label: '百度',
    titlePrefix: '百度来源',
    Icon: GlobalOutlined,
    color: 'oklch(0.55 0.2 260)',
    pattern: /baidu\.com|百度/i,
  },
  {
    kind: 'netease',
    label: '网易',
    titlePrefix: '网易来源',
    Icon: FileTextOutlined,
    color: 'oklch(0.56 0.2 25)',
    pattern: /163\.com|netease|网易/i,
  },
  {
    kind: 'qq',
    label: 'QQ',
    titlePrefix: 'QQ 来源',
    Icon: QqOutlined,
    color: 'oklch(0.58 0.18 250)',
    pattern: /qzone\.qq\.com|QQ空间|QQ/i,
  },
  {
    kind: 'dingtalk',
    label: '钉钉',
    titlePrefix: '钉钉来源',
    Icon: DingdingOutlined,
    color: 'oklch(0.58 0.18 250)',
    pattern: /dingtalk|dingding|钉钉/i,
  },
  {
    kind: 'youtube',
    label: 'YouTube',
    titlePrefix: 'YouTube 来源',
    Icon: YoutubeOutlined,
    color: 'oklch(0.58 0.22 25)',
    pattern: /youtube\.com|youtu\.be|youtube/i,
  },
  {
    kind: 'twitter',
    label: 'X',
    titlePrefix: 'X 来源',
    Icon: XOutlined,
    color: 'var(--text-muted)',
    pattern: /twitter\.com|x\.com|推特|twitter/i,
  },
  {
    kind: 'chrome',
    label: '浏览器',
    titlePrefix: '网页来源',
    Icon: ChromeOutlined,
    color: 'var(--text-muted)',
    pattern: /chromewebstore\.google\.com|chrome\.google\.com/i,
  },
];

const DEFAULT_SOURCE_ICON: ArticleSourceIcon = {
  kind: 'web',
  label: '网页',
  titlePrefix: '网页来源',
  Icon: GlobalOutlined,
  color: 'var(--text-muted)',
};

function getHostLabel(originalUrl?: string | null) {
  if (!originalUrl) return '';

  try {
    return new URL(originalUrl).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function getArticleSourceText(article: any) {
  return article?.source || article?.author || getHostLabel(article?.originalUrl) || '未知来源';
}

export function getArticleSourceIcon(article: any): ArticleSourceIcon {
  const originalUrl = article?.originalUrl || '';
  const source = article?.source || '';
  const author = article?.author || '';
  const title = article?.title || '';
  const host = getHostLabel(originalUrl);
  const haystack = [originalUrl, host, source, author, title].filter(Boolean).join(' ');

  return SOURCE_ICON_RULES.find((rule) => rule.pattern.test(haystack)) ?? DEFAULT_SOURCE_ICON;
}
