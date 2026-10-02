import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const apiRoot = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, apiRoot), 'utf8');

test('macOS 工程固定最新平台且不包含分享扩展权限', () => {
  const project = read('../macos/project.yml');
  const packageJson = read('../../package.json');
  const build = read('../macos/scripts/build-dmg.sh');

  assert.match(project, /macOS: "27\.0"/);
  assert.match(project, /SWIFT_VERSION: "6\.0"/);
  assert.match(project, /SWIFT_STRICT_CONCURRENCY: complete/);
  assert.match(project, /ARCHS: arm64/);
  assert.match(project, /PRODUCT_BUNDLE_IDENTIFIER: com\.idickies\.storing\.macos/);
  // 微信分享扩展不用 App Group：共享目录模式对 Developer ID 与本地构建都稳定。
  assert.doesNotMatch(project, /application-groups/);
  assert.match(packageJson, /macos:generate/);
  assert.match(packageJson, /macos:test/);
  assert.match(packageJson, /macos:build/);
  assert.match(build, /CODE_SIGNING_ALLOWED=NO/);
  assert.match(build, /MACOS_DMG_DRY_RUN/);
  assert.match(build, /hdiutil create/);
});

test('QiankunjieKit 暴露全部原生模块占位', () => {
  const manifest = read('../macos/Packages/QiankunjieKit/Package.swift');

  for (const module of [
    'QiankunjieCore',
    'QiankunjieNetworking',
    'QiankunjieAuth',
    'QiankunjieLibrary',
    'QiankunjieCollect',
    'QiankunjieReader',
    'QiankunjieDesignSystem',
    'QiankunjieUpdating',
    'QiankunjieWeChat',
  ]) {
    assert.match(manifest, new RegExp(module));
  }
});

test('macOS 测试脚本串联工程生成、包测试和应用测试', () => {
  const script = read('../macos/scripts/test.sh');

  assert.match(script, /"\$\{xcodegen_bin\}" generate/);
  assert.match(script, /swift test/);
  assert.match(script, /xcodebuild/);
  assert.match(script, /test/);
});

test('macOS 脚本统一使用校验脚本解析的 XcodeGen', () => {
  for (const name of ['build-dmg.sh', 'test.sh', 'macos-ui-lab.sh']) {
    const script = read(`../macos/scripts/${name}`);
    assert.match(script, /verify-xcode\.sh" --print-xcodegen-bin/);
    assert.match(script, /"\$\{xcodegen_bin\}" generate/);
    assert.doesNotMatch(script, /(?<![_"${])xcodegen generate/);
  }

  const verify = read('../macos/scripts/verify-xcode.sh');
  assert.match(verify, /--print-xcodegen-bin/);
  assert.match(verify, /XCODEGEN_BIN:-xcodegen/);
  assert.match(verify, /\/opt\/homebrew\/bin\/xcodegen/);

  const packageJson = read('../../package.json');
  assert.match(packageJson, /--print-xcodegen-bin/);
});

test('DMG 包含中文首次运行说明且校验请求始终直连 GitHub', () => {
  const build = read('../macos/scripts/build-dmg.sh');
  const updater = read('../macos/Packages/QiankunjieKit/Sources/QiankunjieUpdating/GitHubUpdateService.swift');

  assert.match(build, /首次运行说明\.txt/);
  assert.match(build, /Gatekeeper/);
  assert.match(build, /更新失败/);
  assert.match(updater, /Self\.applyMirror\(release\.downloadURL/);
  assert.doesNotMatch(updater, /applyMirror\(checksumURL/);
});

test('微信分享扩展保持沙盒、无网络且只写共享 Inbox', () => {
  const project = read('../macos/project.yml');
  const info = read('../macos/QiankunjieShare/Info.plist');
  const entitlements = read('../macos/QiankunjieShare/QiankunjieShare.entitlements');
  const share = read('../macos/QiankunjieShare/ShareViewController.swift');
  const coordinator = read('../macos/QiankunjieMac/App/WeChatImportCoordinator.swift');

  // 分享入口只声明接收文件，出现在微信「转发到其他应用」列表。
  assert.match(project, /QiankunjieShare:/);
  assert.match(project, /type: app-extension/);
  assert.match(project, /com\.apple\.share-services/);
  assert.match(info, /NSExtensionActivationSupportsFileWithMaxCount/);
  assert.match(info, /<integer>32<\/integer>/);

  // Extension 无网络权限；唯一文件写入例外是共享 Inbox。
  assert.match(entitlements, /com\.apple\.security\.app-sandbox/);
  assert.match(entitlements, /WeChatInbox/);
  assert.doesNotMatch(entitlements, /com\.apple\.security\.network\.client/);

  // Extension 只落盘并原子提交；解析与上传由主应用完成。
  assert.match(share, /WeChatInbox\.standard\(\)/);
  assert.match(share, /staging\.commit\(manifest:/);
  assert.doesNotMatch(share, /URLSession|URLRequest/);

  // 主应用上传成功后清理批次，失败保留重试。
  assert.match(coordinator, /WeChatInboxWatcher/);
  assert.match(coordinator, /repository\.importFiles\(files\)/);
  assert.match(coordinator, /removeBatch\(at: batchDirectory\)/);
});
