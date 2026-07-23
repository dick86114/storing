#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SDK_ROOT="${ANDROID_SDK_ROOT:-/opt/homebrew/share/android-commandlinetools}"
ADB="${ANDROID_ADB:-$SDK_ROOT/platform-tools/adb}"
PACKAGE="com.idickies.storing.debug"
ACTIVITY="com.idickies.storing.uilab.UiLabActivity"
OUTPUT_DIR="${ANDROID_UI_LAB_OUTPUT_DIR:-$ROOT/artifacts/android-ui-lab}"

usage() {
  cat <<'USAGE'
Usage: scripts/android-ui-lab.sh <command> [arguments]

Commands:
  doctor                         Report ADB, connected devices, emulator and AVD readiness.
  build                          Build the Debug APK.
  install                        Build and install the newest Debug APK on the selected ADB device.
  launch <library|reader|share|tasks>
                                 Launch a deterministic Debug-only UI Lab scenario.
  screenshot [name]              Save a PNG screenshot to artifacts/android-ui-lab/.
  capture <scenario> [name]      Build, install, launch a scenario and save its screenshot.

Optional environment variables:
  ANDROID_SDK_ROOT, ANDROID_ADB, ANDROID_SERIAL, ANDROID_UI_LAB_OUTPUT_DIR
USAGE
}

require_adb() {
  [[ -x "$ADB" ]] || { echo "ADB not found: $ADB" >&2; exit 1; }
}

adb_cmd() {
  require_adb
  if [[ -n "${ANDROID_SERIAL:-}" ]]; then "$ADB" -s "$ANDROID_SERIAL" "$@"; else "$ADB" "$@"; fi
}

latest_apk() {
  local apk_dir="$ROOT/apps/android/app/build/outputs/apk/debug"
  local apks=("$apk_dir"/乾坤戒-v*-debug.apk)
  [[ -e "${apks[0]}" ]] || { echo "Debug APK not found. Run build first." >&2; exit 1; }
  ls -t "${apks[@]}" | head -n 1
}

build() {
  (cd "$ROOT" && pnpm android:assembleDebug)
}

install() {
  build
  adb_cmd wait-for-device
  adb_cmd install -r "$(latest_apk)"
}

validate_scenario() {
  case "$1" in library|reader|share|tasks) ;; *) echo "Unknown UI Lab scenario: $1" >&2; exit 2;; esac
}

launch() {
  local scenario="${1:-library}"
  validate_scenario "$scenario"
  adb_cmd wait-for-device
  adb_cmd shell am force-stop "$PACKAGE"
  adb_cmd shell am start -W -n "$PACKAGE/$ACTIVITY" --es "com.idickies.storing.uilab.SCENARIO" "$scenario"
}

screenshot() {
  local name="${1:-ui-lab-$(date +%Y%m%d-%H%M%S)}"
  name="${name//[^A-Za-z0-9._-]/-}"
  mkdir -p "$OUTPUT_DIR"
  local output="$OUTPUT_DIR/$name.png"
  adb_cmd exec-out screencap -p > "$output"
  echo "$output"
}

doctor() {
  require_adb
  echo "ADB: $ADB"
  adb_cmd devices
  local emulator="$SDK_ROOT/emulator/emulator"
  if [[ -x "$emulator" ]]; then
    echo "Emulator: $emulator"
    "$emulator" -list-avds || true
  else
    echo "Emulator binary is not installed. Run scripts/android-create-ui-emulator.sh when ready."
  fi
}

case "${1:-}" in
  doctor) doctor ;;
  build) build ;;
  install) install ;;
  launch) launch "${2:-library}" ;;
  screenshot) screenshot "${2:-}" ;;
  capture) install; launch "${2:-library}"; sleep 1; screenshot "${3:-${2:-library}}" ;;
  *) usage; exit 2 ;;
esac
