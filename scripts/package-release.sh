#!/bin/bash
# 打包可下载的 Universal 应用；可通过第一个参数指定单一架构。
set -euo pipefail
cd "$(dirname "$0")/.."

ARCH="${1:-universal}"
OUTPUT="${2:-dist/release}"
VERSION="$(tr -d '[:space:]' < "VERSION")"
mkdir -p "$OUTPUT"
OUTPUT="$(cd "$OUTPUT" && pwd)"
NAME="DevTools-v$VERSION-macos-$ARCH.zip"
if [ -e "$OUTPUT/$NAME" ] || [ -e "$OUTPUT/SHA256SUMS.txt" ]; then
  echo "发布产物已存在，请指定新的输出目录，避免覆盖校验文件或安装包。" >&2
  exit 1
fi
bash "build.sh" --arch "$ARCH" --output "$OUTPUT/build-$ARCH"
APP="$OUTPUT/build-$ARCH/DevTools.app"
# 真实 WebKit 检查打包资源，避免仅源码通过而应用包缺少资源。
xcrun swift "tests/webkit-smoke.swift" "$APP/Contents/Resources/index.html"
ditto -c -k --sequesterRsrc --keepParent "$APP" "$OUTPUT/$NAME"
(cd "$OUTPUT" && LC_ALL=C shasum -a 256 "$NAME" > "SHA256SUMS.txt")
echo "安装包: $OUTPUT/$NAME"
echo "校验文件: $OUTPUT/SHA256SUMS.txt"
