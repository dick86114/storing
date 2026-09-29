#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "用法：$0 <login|library|empty|loading|offline|reader|collect|tasks|settings|update>"
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" || $# -ne 1 ]]; then
  usage
  exit 1
fi

scenario="${1}"
case "${scenario}" in
  "login"|"library"|"empty"|"loading"|"offline"|"reader"|"collect"|"tasks"|"settings"|"update")
    ;;
  *)
    echo "错误：未知 UI Lab 场景 $scenario。"
    usage
    exit 1
    ;;
esac

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
macos_dir="$(cd "${script_dir}/.." && pwd)"
repo_dir="$(cd "${macos_dir}/../.." && pwd)"
derived_data="${MACOS_DERIVED_DATA:-${macos_dir}/.derivedData}"
screenshot_dir="${repo_dir}/artifacts/macos-ui-lab/${scenario}"

xcodegen_bin="$("${script_dir}/verify-xcode.sh" --print-xcodegen-bin)"
cd "${macos_dir}"
"${xcodegen_bin}" generate

xcodebuild \
  -project Qiankunjie.xcodeproj \
  -scheme QiankunjieMac \
  -configuration Debug \
  -destination "platform=macOS,arch=arm64" \
  -derivedDataPath "${derived_data}" \
  CODE_SIGNING_ALLOWED=NO \
  build

app_path="${derived_data}/Build/Products/Debug/QiankunjieMac.app"
mkdir -p "${screenshot_dir}"
open -n "${app_path}" --args --ui-lab "${scenario}"

echo "UI Lab 场景已启动：${scenario}"
echo "浅色截图路径：${screenshot_dir}/light.png"
echo "深色截图路径：${screenshot_dir}/dark.png"
echo "截图后请人工确认布局、文本换行、交互态和无真实账号数据。"
