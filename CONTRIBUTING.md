# 参与贡献

提交前请先查看现有 Issue，避免重复工作。

## 报告问题

请使用 Bug 模板，提供 macOS 版本、芯片架构、DevTools 版本、最小复现步骤，以及预期和实际结果。示例输入请替换成不含凭据、个人信息或内部业务数据的内容。

功能建议请说明具体使用场景和预期行为。新增运行时依赖或调整工具交互前，建议先开 Issue 讨论。

## 开发与验证

1. Fork 仓库，从 `main` 创建自己的开发分支。
2. 先阅读对应工具的 HTML 与事件逻辑，保持现有中文注释风格。
3. 修复缺陷时，在 `tests/regression.test.cjs` 或 WKWebView 测试中加入能复现问题的用例。
4. 执行：

```bash
node --check "app.js"
TZ=Asia/Shanghai node --test "tests/regression.test.cjs"
TZ=America/New_York node --test "tests/regression.test.cjs"
xcrun swiftc -typecheck "main.swift" "MainMenu.swift" -framework AppKit -framework WebKit
xcrun swift "tests/webkit-smoke.swift"
bash "build.sh" --arch universal --output "dist/contribution"
```

5. 创建 Pull Request，说明问题、最终行为及验证结果；涉及界面时附截图。

保持实现简单，只实现当前需要的功能，复用已有函数，避免无关重构。请勿提交 `.app`、本机缓存、凭据或构建下载产物。

## 发布流程

以下步骤仅由拥有仓库发布权限的维护者执行。

1. 在 `VERSION` 写入 `X.Y.Z`，并更新 `CHANGELOG.md`。正式版本标签使用 `vX.Y.Z`。
2. 将变更合并到 `main`，确认 Apple Silicon 和 Intel CI 全部通过。
3. 在本地可先运行 `bash "scripts/package-release.sh" universal "dist/release-X.Y.Z"` 验证打包。
4. 在已验证的提交上创建并推送标签：

```bash
git tag -a "vX.Y.Z" -m "DevTools X.Y.Z"
git push origin "vX.Y.Z"
```

5. 等待 Release 工作流完成。它先创建草稿并上传 ZIP 与 `SHA256SUMS.txt`，上传成功后再公开发布，避免出现没有安装包的正式版本。
6. 检查 Release 下载链接、版本号和校验文件。已发布标签与安装包应保持不变；后续修复使用新的版本号。

提交贡献即表示你同意按照本项目的 MIT 许可证分发该贡献。
