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
  assert.doesNotMatch(project, /QiankunjieShareExtension|application-groups/);
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
