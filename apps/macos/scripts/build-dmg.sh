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

"${script_dir}/verify-xcode.sh"

if [[ "${MACOS_DMG_DRY_RUN:-0}" == "1" ]]; then
  echo "[dry-run] 清理 ${output_dir}"
  echo "[dry-run] cd ${macos_dir} && xcodegen generate"
  echo "[dry-run] xcodebuild -project Qiankunjie.xcodeproj -scheme QiankunjieMac -configuration ${configuration} -destination platform=macOS,arch=${architecture} CODE_SIGNING_ALLOWED=NO build"
  echo "[dry-run] 打包 ${app_path} 并执行 hdiutil create 生成 ${versioned_dmg} 和 ${generic_dmg}"
  exit 0
fi

rm -rf "${output_dir}"
mkdir -p "${output_dir}"

cd "${macos_dir}"
xcodegen generate
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

hdiutil create \
  -volname "乾坤戒" \
  -srcfolder "${staging_dir}" \
  -ov \
  -format UDZO \
  "${versioned_dmg}"
cp "${versioned_dmg}" "${generic_dmg}"

echo "DMG 已生成：${versioned_dmg}"
echo "通用 DMG 已生成：${generic_dmg}"
