import AppKit
import WebKit

// 在真实 WKWebView 中使用公开示例生成 README 截图，不读取用户窗口或输入。
let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent()
let output = root.appendingPathComponent("docs/images/overview.png")

class Screenshot: NSObject, WKNavigationDelegate {
    let webView = WKWebView(frame: NSRect(x: 0, y: 0, width: 1180, height: 800))
    let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1180, height: 800),
                          styleMask: [.borderless], backing: .buffered, defer: false)

    func run() {
        window.contentView = webView
        window.setFrameOrigin(NSPoint(x: -2500, y: 0))
        window.orderFront(nil)
        webView.navigationDelegate = self
        let html = root.appendingPathComponent("index.html")
        webView.loadFileURL(html, allowingReadAccessTo: root)
        DispatchQueue.main.asyncAfter(deadline: .now() + 20) {
            fputs("截图生成超时\n", stderr)
            exit(1)
        }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        let script = #"""
        const style = document.createElement('style');
        style.textContent = '*, *::before, *::after { animation: none !important; transition: none !important; }';
        document.head.appendChild(style);
        document.querySelector('.nav-item[data-tool="json"]').click();
        document.getElementById('jsonInput').value = '{"name":"DevTools","version":"1.0.0","offline":true,"id":9007199254740993,"tools":["JSON","时间戳","正则测试"]}';
        document.getElementById('btnJsonFormat').click();
        """#
        webView.evaluateJavaScript(script) { _, error in
            if let error = error { fputs("截图页面初始化失败: \(error)\n", stderr); exit(1) }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                let config = WKSnapshotConfiguration()
                config.rect = self.webView.bounds
                config.snapshotWidth = 1180
                self.webView.takeSnapshot(with: config) { image, error in
                    guard let image = image, let tiff = image.tiffRepresentation,
                          let bitmap = NSBitmapImageRep(data: tiff),
                          let png = bitmap.representation(using: .png, properties: [:]) else {
                        fputs("截图失败: \(String(describing: error))\n", stderr)
                        exit(1)
                    }
                    do {
                        try FileManager.default.createDirectory(at: output.deletingLastPathComponent(), withIntermediateDirectories: true)
                        try png.write(to: output)
                        print("已生成: \(output.path)")
                        exit(0)
                    } catch {
                        fputs("保存截图失败: \(error)\n", stderr)
                        exit(1)
                    }
                }
            }
        }
    }
}

let app = NSApplication.shared
app.setActivationPolicy(.accessory)
app.appearance = NSAppearance(named: .aqua)
let capture = Screenshot()
capture.run()
app.run()
