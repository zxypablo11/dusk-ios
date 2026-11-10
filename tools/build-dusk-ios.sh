#!/usr/bin/env bash
# Build an unsigned, private test artifact. Sideloading supplies the signing identity.
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ "$(uname -s)" != Darwin ]]; then
  echo 'Dusk iOS builds require macOS with Xcode.' >&2
  exit 1
fi
if [[ ! "${DUSK_BUNDLE_ID:-}" =~ ^[A-Za-z][A-Za-z0-9-]*(\.[A-Za-z][A-Za-z0-9-]*){2,}$ ]] || [[ "$DUSK_BUNDLE_ID" == 'io.github.cloverscripts.muriel' ]]; then
  echo 'Set DUSK_BUNDLE_ID to your own reverse-DNS app identifier.' >&2
  exit 1
fi
node tools/build-locales.mjs
node mobile/build.mjs
node node_modules/@capacitor/cli/bin/capacitor sync ios
xcodebuild -quiet \
  -project ios/App/App.xcodeproj -scheme App -configuration Release \
  -sdk iphoneos -destination 'generic/platform=iOS' -derivedDataPath build/dusk \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY='' \
  DUSK_BUNDLE_IDENTIFIER="$DUSK_BUNDLE_ID" build
mkdir -p dist
DUSK_PACKAGE_DIR="$(mktemp -d)"
trap 'rm -rf "$DUSK_PACKAGE_DIR"' EXIT
mkdir "$DUSK_PACKAGE_DIR/Payload"
cp -R build/dusk/Build/Products/Release-iphoneos/App.app "$DUSK_PACKAGE_DIR/Payload/"
DUSK_OUTPUT_PATH="$PWD/dist/Dusk.ipa"
# A fresh archive avoids retaining files removed from a previous build.
(cd "$DUSK_PACKAGE_DIR" && zip -qry Dusk.ipa Payload)
mv "$DUSK_PACKAGE_DIR/Dusk.ipa" "$DUSK_OUTPUT_PATH"
echo "Unsigned artifact: $DUSK_OUTPUT_PATH"
