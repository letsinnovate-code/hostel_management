#!/bin/bash
# Build release APK with Expo (prebuild + Gradle) and install on USB-connected Android device.
# Prereqs: USB debugging enabled on phone, adb in PATH.
# Run from mobile-app: ./build_and_install.sh   or   npm run android:install:apk

set -e
cd "$(dirname "$0")"

# Ensure native project exists (Expo prebuild)
if [ ! -d "android" ]; then
  echo "Generating Android project (expo prebuild)..."
  npx expo prebuild --platform android --clean
fi

echo "Building release APK (Gradle)..."
cd android
./gradlew assembleRelease --no-daemon
cd ..

APK="android/app/build/outputs/apk/release/app-release.apk"
if [ ! -f "$APK" ]; then
  echo "Error: APK not found at $APK"
  exit 1
fi

# Check device
if ! command -v adb &>/dev/null; then
  echo "Error: adb not found. Install Android SDK platform-tools and add to PATH."
  exit 1
fi

DEVICES=$(adb devices | grep -w 'device' | wc -l)
if [ "$DEVICES" -eq 0 ]; then
  echo "No Android device found. Connect your phone via USB and enable USB debugging, then run:"
  echo "  adb install -r $APK"
  echo "Or run this script again with the device connected."
  exit 1
fi

echo "Installing on device..."
adb install -r "$APK"
echo "Done. HostelZify (release) is installed on your device."
