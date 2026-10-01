#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
macos_dir="$(cd "${script_dir}/.." && pwd)"
configuration="${MACOS_CONFIGURATION:-Release}"
derived_data="${MACOS_DERIVED_DATA:-${macos_dir}/.derivedData}"
output_dir="${MACOS_OUTPUT_DIR:-${macos_dir}/dist}"
version="${MACOS_VERSION:-0.1.0}"
architecture="arm64"
app_path="${derived_data}/Build/Products/${configuration}/storing.app"
versioned_dmg="${output_dir}/Qiankunjie-${version}-${architecture}.dmg"
generic_dmg="${output_dir}/Qiankunjie.dmg"
binary_path="${app_path}/Contents/MacOS/storing"
versioned_checksum="${versioned_dmg}.sha256"
generic_checksum="${generic_dmg}.sha256"

xcodegen_bin="$("${script_dir}/verify-xcode.sh" --print-xcodegen-bin)"

if [[ "${MACOS_DMG_DRY_RUN:-0}" == "1" ]]; then
  echo "[dry-run] 清理 ${output_dir}"
  echo "[dry-run] cd ${macos_dir} && \"${xcodegen_bin}\" generate"
  echo "[dry-run] xcodebuild -project Qiankunjie.xcodeproj -scheme QiankunjieMac -configuration ${configuration} -destination platform=macOS,arch=${architecture} CODE_SIGNING_ALLOWED=NO build"
  echo "[dry-run] 对 ${app_path} 补做完整的 ad-hoc 签名并执行 codesign --verify --deep --strict"
  echo "[dry-run] 打包 ${app_path} 并执行 hdiutil create 生成 ${versioned_dmg} 和 ${generic_dmg}"
  exit 0
fi

rm -rf "${output_dir}"
mkdir -p "${output_dir}"

cd "${macos_dir}"
"${xcodegen_bin}" generate
xcodebuild \
  -project Qiankunjie.xcodeproj \
  -scheme QiankunjieMac \
  -configuration "${configuration}" \
  -destination "platform=macOS,arch=${architecture}" \
  -derivedDataPath "${derived_data}" \
  CODE_SIGNING_ALLOWED=NO \
  build

# CODE_SIGNING_ALLOWED=NO 时只有链接器级别的临时签名，bundle 签名不完整：
# codesign --verify 会报 "code has no resources but signature indicates they must be present"，
# 文件带上网络下载隔离属性后会被 Gatekeeper 直接判为“已损坏”。这里补一次完整签名。
codesign --force --sign - --timestamp=none "${app_path}"
codesign --verify --deep --strict "${app_path}"

staging_dir="$(mktemp -d)"
trap 'rm -rf "${staging_dir}"' EXIT

cp -R "${app_path}" "${staging_dir}/乾坤戒.app"
ln -s /Applications "${staging_dir}/Applications"

cat > "${staging_dir}/安装乾坤戒.command" <<'SCRIPT'
#!/bin/sh
set -eu

# 乾坤戒一键安装：复制到 /Applications 并去掉网络下载隔离属性。

script_dir="$(cd "$(dirname "$0")" && pwd)"
source_app="${script_dir}/乾坤戒.app"
target_app="/Applications/乾坤戒.app"

if [ ! -d "${source_app}" ]; then
  echo "找不到乾坤戒.app，请确认它和本脚本在同一个磁盘映像里。"
  exit 1
fi

echo "即将安装到 ${target_app}"
echo

if [ -d "${target_app}" ]; then
  trash_dir="${HOME}/.Trash"
  mkdir -p "${trash_dir}"
  backup="${trash_dir}/乾坤戒-旧版本-$(date +%Y%m%d-%H%M%S).app"
  echo "检测到已安装的乾坤戒，先把旧版本移到废纸篓：${backup}"
  if ! mv "${target_app}" "${backup}" 2>/dev/null; then
    rm -rf "${target_app}"
  fi
fi

if ! /usr/bin/ditto "${source_app}" "${target_app}" 2>/dev/null; then
  echo "复制失败：请确认当前账号有 /Applications 的写入权限。"
  exit 1
fi

# 清掉 Chrome 等浏览器下载时附上的隔离属性，否则系统会把未签名的应用报成“已损坏”。
/usr/bin/xattr -dr com.apple.quarantine "${target_app}" 2>/dev/null || true

echo "安装完成，正在打开乾坤戒。"
/usr/bin/open "${target_app}"

echo
echo "现在可以关闭这个窗口。"
SCRIPT
chmod +x "${staging_dir}/安装乾坤戒.command"

cat > "${staging_dir}/首次运行说明.txt" <<'EOF'
乾坤戒 macOS 安装说明

系统要求：Apple Silicon Mac 和 macOS 27 或更高版本。

推荐方式（最简单）：
  1. 双击本磁盘映像里的「安装乾坤戒.command」。
  2. 如果提示“无法验证开发者”或“无法打开”，请右键点击该脚本，选择“打开”，再确认一次。
  脚本会自动安装到 /Applications、去掉网络下载隔离属性，并打开乾坤戒。

手动方式：
  1. 把「乾坤戒.app」拖到「Applications」文件夹。
  2. 打开「终端」，执行下面这一行：

     xattr -dr com.apple.quarantine /Applications/乾坤戒.app

为什么需要这一步：当前安装包没有 Apple 开发者证书和公证。macOS 会给从网上下载的
应用加上隔离属性，没有开发者签名的应用此时会提示“已损坏，无法打开”。上面这一步
只是清除下载标记，不会修改应用内容，也不影响后续在应用内自动更新。

应用更新：请在应用内检查更新、下载并校验 SHA-256，然后选择退出并安装。
更新失败时，请保留提示中的备份目录，并按恢复命令把备份恢复到：

  /Applications/乾坤戒.app

不要删除备份目录，也不要手动删除当前应用，除非已经确认有可用的备份。
EOF

hdiutil create \
  -volname "乾坤戒" \
  -srcfolder "${staging_dir}" \
  -ov \
  -format UDZO \
  "${versioned_dmg}"
cp "${versioned_dmg}" "${generic_dmg}"

actual_version="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "${app_path}/Contents/Info.plist")"
if [[ "${actual_version}" != "${version}" ]]; then
  echo "错误：应用版本为 ${actual_version}，预期为 ${version}。"
  exit 1
fi

binary_archs="$(lipo -archs "${binary_path}")"
if [[ " ${binary_archs} " != *" arm64 "* ]]; then
  echo "错误：应用可执行文件缺少 arm64 架构，实际为：${binary_archs:-未知}。"
  exit 1
fi

hdiutil verify "${versioned_dmg}"

(
  cd "${output_dir}"
  shasum -a 256 "$(basename "${versioned_dmg}")" > "$(basename "${versioned_checksum}")"
  shasum -a 256 "$(basename "${generic_dmg}")" > "$(basename "${generic_checksum}")"
)

echo "DMG 已生成：${versioned_dmg}"
echo "通用 DMG 已生成：${generic_dmg}"
echo "校验文件已生成：${versioned_checksum} 和 ${generic_checksum}"
