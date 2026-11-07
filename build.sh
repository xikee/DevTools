#!/bin/bash
# 构建本地、Intel 或 Universal macOS 应用，不覆盖已有应用包。
set -euo pipefail
cd "$(dirname "$0")"

VERSION="$(tr -d '[:space:]' < "VERSION")"
ARCH="$(uname -m)"
OUTPUT="dist"
OPEN_APP=false
usage() {
  echo "用法: bash build.sh [--arch arm64|x86_64|universal] [--output 目录] [--open]"
}
while [ "$#" -gt 0 ]; do
  case "$1" in
    --arch|--output)
      [ "$#" -ge 2 ] || { usage; exit 1; }
      if [ "$1" = "--arch" ]; then ARCH="$2"; else OUTPUT="$2"; fi
      shift 2 ;;
    --open) OPEN_APP=true; shift ;;
    --help|-h) usage; exit 0 ;;
    *) usage; exit 1 ;;
  esac
done
case "$ARCH" in arm64|x86_64|universal) ;; *) echo "不支持的架构: $ARCH" >&2; exit 1 ;; esac
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "VERSION 必须是 x.y.z" >&2; exit 1; }
mkdir -p "$OUTPUT"
OUTPUT="$(cd "$OUTPUT" && pwd)"
DEST="$OUTPUT/DevTools.app"
if [ -e "$DEST" ]; then
  echo "目标已存在: ${DEST}。请用 --output 指定新的输出目录，避免覆盖已有应用。" >&2
  exit 1
fi
WORK="$(mktemp -d "${TMPDIR:-/tmp}/devtools-build.XXXXXX")"
APP="$WORK/DevTools.app"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
compile() {
  xcrun swiftc -O -target "$1-apple-macos14.0" "main.swift" "MainMenu.swift" \
    -framework AppKit -framework WebKit -o "$2"
}
echo "==> 构建 DevTools $VERSION (${ARCH}，最低 macOS 14.0)"
if [ "$ARCH" = "universal" ]; then
  compile arm64 "$WORK/DevTools-arm64"
  compile x86_64 "$WORK/DevTools-x86_64"
  xcrun lipo -create "$WORK/DevTools-arm64" "$WORK/DevTools-x86_64" -output "$APP/Contents/MacOS/DevTools"
else
  compile "$ARCH" "$APP/Contents/MacOS/DevTools"
fi
cp "index.html" "app.js" "LICENSE" "$APP/Contents/Resources/"
cp "icon/AppIcon.icns" "$APP/Contents/Resources/AppIcon.icns"
cat > "$APP/Contents/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key><string>DevTools</string>
    <key>CFBundleDisplayName</key><string>DevTools 开发工具箱</string>
    <key>CFBundleExecutable</key><string>DevTools</string>
    <key>CFBundleIdentifier</key><string>com.local.devtools</string>
    <key>CFBundleIconFile</key><string>AppIcon</string>
    <key>CFBundlePackageType</key><string>APPL</string>
    <key>CFBundleShortVersionString</key><string>$VERSION</string>
    <key>CFBundleVersion</key><string>$VERSION</string>
    <key>LSMinimumSystemVersion</key><string>14.0</string>
    <key>NSHighResolutionCapable</key><true/>
    <key>NSPrincipalClass</key><string>NSApplication</string>
</dict>
</plist>
EOF

plutil -lint "$APP/Contents/Info.plist"
codesign --force --sign - "$APP"
codesign --verify --deep --strict "$APP"
mv "$APP" "$DEST"
echo "==> 完成: $DEST"
if $OPEN_APP; then open "$DEST"; fi
