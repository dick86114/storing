import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { ensureUserNotificationSchema } from '../src/services/user-notification.service.ts';

const serviceSource = readFileSync(
  new URL('../src/services/user-notification.service.ts', import.meta.url),
  'utf8',
);

test('用户通知表按用户隔离并记录深度报告上下文', () => {
  assert.match(serviceSource, /export async function ensureUserNotificationSchema\(\): Promise<void>/);
  assert.match(serviceSource, /user_id INTEGER NOT NULL REFERENCES users\(id\) ON DELETE CASCADE/);
  assert.match(serviceSource, /article_id INTEGER/);
  assert.match(serviceSource, /report_version INTEGER/);
  assert.match(serviceSource, /title TEXT NOT NULL/);
  assert.match(serviceSource, /body TEXT NOT NULL/);
});

test('完成通知只包含标题和状态，不包含报告正文', () => {
  assert.match(serviceSource, /createDeepAnalysisNotification/);
  assert.doesNotMatch(serviceSource, /reportJson/);
  assert.match(serviceSource, /深度报告已生成/);
  assert.match(serviceSource, /已读|markUserNotificationRead|markRead/);
});

test('通知列表和已读接口按认证用户过滤', () => {
  assert.match(serviceSource, /export async function listUserNotifications\(\s*userId: number,/);
  assert.match(serviceSource, /export async function markUserNotificationRead\(userId: number, notificationId: number\)/);
});

test('通知模式可初始化且服务可导入', async () => {
  await ensureUserNotificationSchema();
});
