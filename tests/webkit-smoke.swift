import AppKit
import WebKit

// 用法：xcrun swift tests/webkit-smoke.swift [index.html 路径]
// 使用真实 WKWebView 和 file:// 页面验证，不依赖浏览器插件或外部服务。
let defaultHTML = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
    .deletingLastPathComponent().appendingPathComponent("index.html")
let htmlURL = CommandLine.arguments.count > 1
    ? URL(fileURLWithPath: CommandLine.arguments[1]) : defaultHTML

class SmokeTest: NSObject, WKNavigationDelegate {
    let webView = WKWebView(frame: NSRect(x: 0, y: 0, width: 1180, height: 800))

    func run() {
        webView.navigationDelegate = self
        webView.loadFileURL(htmlURL, allowingReadAccessTo: htmlURL.deletingLastPathComponent())
        DispatchQueue.main.asyncAfter(deadline: .now() + 25) {
            fputs("FAIL: WKWebView 验证超时\n", stderr)
            exit(1)
        }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        let script = #"""
        const $ = id => document.getElementById(id);
        let count = 0;
        function check(ok, name) { if (!ok) throw new Error(name); count++; }
        function input(id, value) { $(id).value = value; $(id).dispatchEvent(new Event('input')); }
        function change(id, value) { $(id).value = value; $(id).dispatchEvent(new Event('change')); }
        function click(id) { $(id).click(); }
        async function finished() {
          const deadline = Date.now() + 2500;
          while (!$('btnReCancel').disabled) {
            if (Date.now() > deadline) throw new Error('正则任务未结束');
            await new Promise(resolve => setTimeout(resolve, 10));
          }
        }
        check($('tsNowSec').textContent !== '-', '页面脚本初始化');
        document.querySelector('[data-tool="json"]').click();
        check(document.querySelector('.panel.active').dataset.tool === 'json', '导航切换');
        input('jsonInput', '{"id":9007199254740993,"n":1e400}'); click('btnJsonFormat');
        check($('jsonOut').textContent.includes('9007199254740993'), 'JSON 大整数保真');
        check($('jsonOut').textContent.includes('1e400'), 'JSON 指数保真');
        input('jsonInput', '{"s":"<img src=x onerror=alert(1)> & 中文"}'); click('btnJsonFormat');
        check($('jsonOut').querySelector('img') === null, 'JSON 高亮转义');
        check($('jsonOut').textContent.includes('<img'), 'JSON 高亮文本完整');
        input('tsDateInput', '2026-02-30');
        check($('tsToTsOut').className === 'err', '拒绝非法日期');
        input('tsDateInput', '2026-09-17T12:00:00.1Z');
        check($('tsToTsOut').textContent.includes('1789646400100'), '小数秒转换');
        input('tsDateInput', '0099-01-01T00:00:00Z');
        check($('tsToTsOut').textContent.includes(String(Date.parse('0099-01-01T00:00:00Z'))), '早期年份');
        input('tsInput', '86400000'); change('tsUnit', 'ms'); change('tsTz', 'utc');
        check($('tsToDateOut').textContent.includes('1970-01-02'), '毫秒单位选择');
        input('urlInput', 'https://example.com/?q=what?yes&x=1'); click('btnUrlParse');
        check(document.querySelectorAll('#urlParams tbody tr').length === 2, 'URL 参数不截断');
        check(document.querySelector('#urlParams tbody td:nth-child(2)').textContent === 'what?yes', 'URL 问号保留');
        input('urlInput', 'https://example.com/#/page?x=1'); click('btnUrlParse');
        check($('urlParams').textContent.includes('无参数'), '排除片段参数');
        input('b64Input', 'aGVsbG8='); click('btnB64Dec');
        input('b64Input', '%%%'); click('btnB64Dec');
        check($('b64Out').textContent === '', 'Base64 失败清空');
        change('baseFrom', '16'); input('baseInput', '-0xFF');
        check($('baseDec').textContent === '-255', '负数前缀');
        input('rePattern', '(a)(b)?'); input('reText', 'ab a'); click('btnReTest'); await finished();
        check($('reErr').textContent === '', '离线 Blob Worker 执行: ' + $('reErr').textContent);
        check($('reResult').textContent.includes('组2: (未匹配)'), 'Worker 捕获组');
        input('reReplace', '$2$1'); click('btnReReplace'); await finished();
        check($('reReplaceOut').textContent === 'ba a', 'Worker 替换');
        input('rePattern', '['); click('btnReTest'); await finished();
        check($('reErr').textContent.includes('正则错误'), '正则语法错误');
        input('rePattern', '(?:)'); input('reText', 'a'.repeat(2000)); click('btnReTest'); await finished();
        check($('reErr').textContent.includes('仅展示前 1000'), '匹配数量限制');
        input('rePattern', '(a+)+$'); input('reText', 'a'.repeat(1000) + '!'); click('btnReTest');
        check(!$('btnReCancel').disabled, '正则任务启动');
        click('btnReCancel');
        check($('reErr').textContent === '已取消', '正则取消');
        let responsive = false;
        setTimeout(() => { responsive = true; }, 0);
        const started = Date.now();
        click('btnReTest'); await finished();
        check(responsive, '执行时界面仍能响应');
        // 不同 WebKit 版本可能提前限制回溯并返回无匹配，检查响应时间即可。
        check(Date.now() - started < 2000, '回溯测试没有阻塞界面');
        // 使用确定不会结束的真实 Worker，独立验证定时终止，不依赖引擎的回溯优化。
        const NativeWorker = window.Worker;
        const busyURL = URL.createObjectURL(new Blob(['onmessage = () => { while (true) {} };'], { type: 'text/javascript' }));
        try {
          window.Worker = class { constructor() { return new NativeWorker(busyURL); } };
          click('btnReTest');
          window.Worker = NativeWorker;
          await finished();
          check($('reErr').textContent.includes('执行超过 1 秒'), '真实 Worker 超时终止');
        } finally {
          window.Worker = NativeWorker;
          URL.revokeObjectURL(busyURL);
        }
        input('rePattern', 'a'); input('reText', 'abc'); click('btnReTest'); await finished();
        check($('reResult').textContent === '#1 [0] "a"', '停止后恢复使用');
        input('hashInput', 'abc'); click('btnSha256');
        check($('hashOut').textContent === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', 'WebKit 哈希');
        return count;
        """#
        webView.callAsyncJavaScript(script, arguments: [:], in: nil, in: .page) { result in
            switch result {
            case .success(let value):
                print("PASS: WKWebView \(value) 项检查通过")
                exit(0)
            case .failure(let error):
                fputs("FAIL: \(error) \((error as NSError).userInfo)\n", stderr)
                exit(1)
            }
        }
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        fputs("FAIL: 页面加载失败 \(error)\n", stderr)
        exit(1)
    }
}

let app = NSApplication.shared
app.setActivationPolicy(.accessory)
let test = SmokeTest()
test.run()
app.run()
