#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "用法：$0 <login|library|empty|loading|offline|reader|collect|tasks|settings|update|update-notice|current-version> [light|dark]"
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" || $# -lt 1 || $# -gt 2 ]]; then
  usage
  exit 1
fi

scenario="${1}"
case "${scenario}" in
  "login"|"library"|"empty"|"loading"|"offline"|"reader"|"collect"|"tasks"|"settings"|"update"|"update-notice"|"current-version")
    ;;
  *)
    echo "错误：未知 UI Lab 场景 $scenario。"
    usage
    exit 1
    ;;
esac

appearance="${2:-}"
if [[ -n "$appearance" && "$appearance" != "light" && "$appearance" != "dark" ]]; then
  echo "错误：外观必须是 light 或 dark。"
  exit 1
fi

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

app_path="${derived_data}/Build/Products/Debug/storing.app"
mkdir -p "${screenshot_dir}"
appearance_args=()
if [[ -n "$appearance" ]]; then
  appearance_args=(--ui-lab-appearance "$appearance")
fi
open -n "${app_path}" --args --ui-lab "${scenario}" "${appearance_args[@]}"

echo "UI Lab 场景已启动：${scenario}"
echo "浅色截图路径：${screenshot_dir}/light.png"
echo "深色截图路径：${screenshot_dir}/dark.png"
echo "截图后请人工确认布局、文本换行、交互态和无真实账号数据。"
