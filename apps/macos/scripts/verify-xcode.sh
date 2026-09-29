#!/usr/bin/env bash
set -euo pipefail

required_xcode_major="27"
required_swift_version="6.4"
required_xcodegen_version="2.46.0"
required_sdk_major="27"

# 构建产物固定使用 Xcode 27 提供的 macOS 27 SDK。

xcodegen_bin="${XCODEGEN_BIN:-xcodegen}"
if [[ ! -x "${xcodegen_bin}" && -x /opt/homebrew/bin/xcodegen ]]; then
  xcodegen_bin="/opt/homebrew/bin/xcodegen"
fi

if ! command -v xcodebuild >/dev/null 2>&1; then
  echo "错误：未找到 xcodebuild。"
  exit 1
fi

xcode_version="$(xcodebuild -version | sed -n '1s/^Xcode //p')"
if [[ "${xcode_version%%.*}" != "${required_xcode_major}" ]]; then
  echo "错误：需要 Xcode ${required_xcode_major}，当前为 ${xcode_version:-未知}。"
  exit 1
fi

swift_version="$(swift --version 2>&1 | sed -n 's/.*Apple Swift version \([0-9][0-9.]*\).*/\1/p' | head -n 1)"
if [[ "${swift_version}" != "${required_swift_version}"* ]]; then
  echo "错误：需要 Swift ${required_swift_version}，当前为 ${swift_version:-未知}。"
  exit 1
fi

if [[ "${xcodegen_bin}" == "xcodegen" ]]; then
  if ! command -v "${xcodegen_bin}" >/dev/null 2>&1; then
    echo "错误：未找到 XcodeGen。"
    exit 1
  fi
fi

xcodegen_version="$("${xcodegen_bin}" --version | sed -n 's/^Version: //p')"
if [[ "${xcodegen_version}" != "${required_xcodegen_version}" ]]; then
  echo "错误：需要 XcodeGen ${required_xcodegen_version}，当前为 ${xcodegen_version}。"
  exit 1
fi

sdk_version="$(xcrun --sdk macosx --show-sdk-version)"
if [[ "${sdk_version%%.*}" != "${required_sdk_major}" ]]; then
  echo "错误：需要 macOS ${required_sdk_major} SDK，当前为 ${sdk_version}。"
  exit 1
fi

if [[ "$(uname -m)" != "arm64" ]]; then
  echo "错误：仅支持 Apple Silicon arm64。"
  exit 1
fi

if [[ "${1:-}" == "--print-xcodegen-bin" ]]; then
  printf '%s\n' "${xcodegen_bin}"
else
  echo "工具链校验通过：Xcode ${xcode_version}，Swift ${swift_version}，XcodeGen ${xcodegen_version}，macOS SDK ${sdk_version}，$(uname -m)。"
fi
