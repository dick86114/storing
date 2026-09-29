#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
macos_dir="$(cd "${script_dir}/.." && pwd)"
configuration="${MACOS_CONFIGURATION:-Release}"
derived_data="${MACOS_DERIVED_DATA:-${macos_dir}/.derivedData}"
output_dir="${MACOS_OUTPUT_DIR:-${macos_dir}/dist}"
version="${MACOS_VERSION:-0.1.0}"
architecture="arm64"
app_path="${derived_data}/Build/Products/${configuration}/QiankunjieMac.app"
versioned_dmg="${output_dir}/Qiankunjie-${version}-${architecture}.dmg"
generic_dmg="${output_dir}/Qiankunjie.dmg"
binary_path="${app_path}/Contents/MacOS/QiankunjieMac"
versioned_checksum="${versioned_dmg}.sha256"
generic_checksum="${generic_dmg}.sha256"

xcodegen_bin="$("${script_dir}/verify-xcode.sh" --print-xcodegen-bin)"

if [[ "${MACOS_DMG_DRY_RUN:-0}" == "1" ]]; then
  echo "[dry-run] 清理 ${output_dir}"
  echo "[dry-run] cd ${macos_dir} && \"${xcodegen_bin}\" generate"
  echo "[dry-run] xcodebuild -project Qiankunjie.xcodeproj -scheme QiankunjieMac -configuration ${configuration} -destination platform=macOS,arch=${architecture} CODE_SIGNING_ALLOWED=NO build"
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

staging_dir="$(mktemp -d)"
trap 'rm -rf "${staging_dir}"' EXIT

cp -R "${app_path}" "${staging_dir}/乾坤戒.app"
ln -s /Applications "${staging_dir}/Applications"

cat > "${staging_dir}/首次运行说明.txt" <<'EOF'
乾坤戒 macOS 首次运行说明

系统要求：Apple Silicon Mac 和 macOS 27 或更高版本。

Gatekeeper：当前应用未使用 Developer ID 证书和公证。首次打开如果提示无法验证开发者，
请先确认安装包来自本仓库 GitHub Release，然后在终端执行：

  xattr -dr com.apple.quarantine /Applications/乾坤戒.app

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
