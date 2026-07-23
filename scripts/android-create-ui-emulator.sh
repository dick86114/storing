#!/usr/bin/env bash
set -euo pipefail

SDK_ROOT="${ANDROID_SDK_ROOT:-/opt/homebrew/share/android-commandlinetools}"
SDKMANAGER="$SDK_ROOT/cmdline-tools/latest/bin/sdkmanager"
AVDMANAGER="$SDK_ROOT/cmdline-tools/latest/bin/avdmanager"
AVD_NAME="${ANDROID_UI_LAB_AVD_NAME:-Qiankunjie_API_36}"

[[ -x "$SDKMANAGER" ]] || { echo "sdkmanager not found: $SDKMANAGER" >&2; exit 1; }
[[ -x "$AVDMANAGER" ]] || { echo "avdmanager not found: $AVDMANAGER" >&2; exit 1; }

case "$(uname -m)" in
  arm64) ABI="arm64-v8a" ;;
  x86_64) ABI="x86_64" ;;
  *) echo "Unsupported host architecture: $(uname -m)" >&2; exit 1 ;;
esac

SYSTEM_IMAGE="system-images;android-36;google_apis;$ABI"
echo "Installing Android Emulator, platform tools and $SYSTEM_IMAGE"
"$SDKMANAGER" "emulator" "platform-tools" "platforms;android-36" "$SYSTEM_IMAGE"

if "$AVDMANAGER" list avd | grep -q "Name: $AVD_NAME"; then
  echo "AVD already exists: $AVD_NAME"
else
  echo "no" | "$AVDMANAGER" create avd --force --name "$AVD_NAME" --package "$SYSTEM_IMAGE" --device "pixel_7"
fi

echo
printf 'Launch with:\n%s/emulator/emulator -avd %s\n' "$SDK_ROOT" "$AVD_NAME"
