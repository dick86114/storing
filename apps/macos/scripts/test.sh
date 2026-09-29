#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
macos_dir="$(cd "${script_dir}/.." && pwd)"
derived_data="${MACOS_DERIVED_DATA:-${macos_dir}/.derivedData}"

xcodegen_bin="$("${script_dir}/verify-xcode.sh" --print-xcodegen-bin)"

cd "${macos_dir}"
"${xcodegen_bin}" generate
swift test --package-path Packages/QiankunjieKit
xcodebuild \
  -project Qiankunjie.xcodeproj \
  -scheme QiankunjieMac \
  -configuration Debug \
  -destination "platform=macOS,arch=arm64" \
  -derivedDataPath "${derived_data}" \
  CODE_SIGNING_ALLOWED=NO \
  test
