# 更新日志

本文件记录面向使用者的版本变化。正式版本采用 `MAJOR.MINOR.PATCH` 版本号。

## [1.0.0] - 2026-11-07

首个开源版本。

### 功能

- 提供时间戳、JSON、URL、Base64、UUID、正则、颜色、进制、哈希和文本处理共 10 类工具。
- 使用 Swift、AppKit 和 WKWebView，支持离线处理和系统深浅色外观。
- 提供 macOS 14+ 的 Universal 安装包，覆盖 Apple Silicon 和 Intel。

### 修复

- JSON 格式化与压缩保留大整数、高精度小数、指数表示、负零和重复键。
- 正则匹配与替换在独立 Worker 中运行，支持超时、取消和结果数量限制。
- 严格校验标准日期字段，正确解析 0～99 年及小数秒。
- 时间戳允许手动选择秒／毫秒，并在 UTC 输出中展示解析单位。
- URL 参数解析保留参数内的问号，排除片段中的伪 Query。
- Base64 解码失败时清空旧结果；复制失败时如实提示。
- 支持 `-0xFF`、`-0b10`、`-0o10` 等带前缀负数。

### 工程

- 增加跨时区回归测试和真实 WKWebView 检查。
- 增加 CI、Release 自动打包、SHA-256 校验与贡献模板。

[1.0.0]: https://github.com/xikee/DevTools/releases/tag/v1.0.0
