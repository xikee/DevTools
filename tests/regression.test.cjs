/* 回归测试：直接触发页面事件；Worker 使用独立线程，覆盖超时与取消行为。 */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { resolveObjectURL } = require('node:buffer');
const { Worker: ThreadWorker } = require('node:worker_threads');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const source = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

function createApp(t, options = {}) {
  const elements = new Map(), timers = new Set(), workers = new Set();
  const copied = [];
  class Element {
    constructor() {
      this.value = ''; this.textContent = ''; this.style = {}; this.events = {};
      this.children = []; this.disabled = false;
      this.classList = { add() {}, remove() {} };
    }
    set innerHTML(value) {
      this.textContent = value.replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
      this.children = [];
    }
    addEventListener(type, handler) { this.events[type] = handler; }
    appendChild(el) { this.children.push(el); }
    removeChild(el) { this.children.splice(this.children.indexOf(el), 1); }
    focus() {} select() {}
  }
  for (const match of html.matchAll(/<[a-z]+\b[^>]*\bid="([^"]+)"[^>]*>/g)) {
    const el = new Element();
    el.value = (match[0].match(/\bvalue="([^"]*)"/) || [null, ''])[1];
    el.disabled = /\bdisabled\b/.test(match[0]);
    elements.set(match[1], el);
  }
  for (const [, id, body] of html.matchAll(/<select\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)) {
    const choices = [...body.matchAll(/<option([^>]*)>([^<]*)<\/option>/g)];
    const choice = choices.find((m) => /\bselected\b/.test(m[1])) || choices[0];
    elements.get(id).value = (choice[1].match(/\bvalue="([^"]*)"/) || [null, choice[2]])[1];
  }
  const tbody = new Element();
  const document = {
    getElementById: (id) => elements.get(id), querySelectorAll: () => [],
    querySelector: (selector) => selector === '#urlParams tbody' ? tbody : null,
    createElement: () => new Element(), body: new Element(),
    activeElement: new Element(),
    execCommand() {
      copied.push(document.body.children.at(-1).value);
      if (options.copyThrows) throw new Error('denied');
      return options.copySucceeds ?? false;
    }
  };
  class BrowserWorker {
    constructor(url) {
      workers.add(this);
      this.pending = [];
      this.stopped = false;
      resolveObjectURL(url).text().then((code) => {
        if (this.stopped) return;
        this.thread = new ThreadWorker(`
          const { parentPort } = require('node:worker_threads');
          globalThis.self = { postMessage: data => parentPort.postMessage(data) };
          parentPort.on('message', data => self.onmessage({ data }));
          ${code}
        `, { eval: true });
        this.thread.on('message', (data) => { if (!this.stopped) this.onmessage?.({ data }); });
        this.thread.on('error', () => { if (!this.stopped) this.onerror?.({ preventDefault() {} }); });
        this.pending.forEach((data) => this.thread.postMessage(data));
      });
    }
    postMessage(data) { this.thread ? this.thread.postMessage(data) : this.pending.push(data); }
    terminate() { this.stopped = true; this.thread?.terminate(); }
  }
  const context = vm.createContext({
    document, navigator: options.clipboard ? { clipboard: options.clipboard } : {},
    window: { isSecureContext: Boolean(options.clipboard) },
    crypto: crypto.webcrypto, TextEncoder, TextDecoder, URL, Blob,
    Worker: options.workerUnavailable ? class { constructor() { throw new Error('unavailable'); } } : BrowserWorker,
    atob, btoa, setInterval() {},
    setTimeout(fn, delay) { const timer = setTimeout(fn, delay); timers.add(timer); return timer; },
    clearTimeout(timer) { clearTimeout(timer); timers.delete(timer); }
  });
  vm.runInContext(source, context, { timeout: 1000 });
  t.after(() => { timers.forEach(clearTimeout); workers.forEach((worker) => worker.terminate()); });
  return {
    elements, tbody, copied,
    set(id, value) { elements.get(id).value = value; },
    click(id) { return elements.get(id).events.click(); },
    input(id) { return elements.get(id).events.input(); },
    change(id) { return elements.get(id).events.change(); },
    out(id) { return elements.get(id).textContent; }
  };
}

async function waitFor(predicate, timeout = 2000) {
  const deadline = Date.now() + timeout;
  while (!predicate()) {
    assert.ok(Date.now() < deadline, '等待页面状态超时');
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

test('JSON 保留大整数、高精度小数、指数、负零和重复键', (t) => {
  const app = createApp(t);
  const raw = '{ "id":9007199254740993,"n":1e400,"decimal":0.1234567890123456789,"z":-0,"x":1,"x":2 }';
  app.set('jsonInput', raw);
  for (const button of ['btnJsonFormat', 'btnJsonMin', 'btnJsonUnescape']) {
    app.click(button);
    assert.equal(app.out('jsonOut').replace(/\s/g, ''), raw.replace(/\s/g, ''));
    assert.equal(app.out('jsonErr'), '');
  }
});

test('JSON 嵌套、空容器、字符串转义及 0/2/4 缩进保持正确', (t) => {
  const app = createApp(t);
  const value = { text: ' <>& \\" : , \n ', nested: [[], {}, { a: '中文🙂' }], bool: true, nil: null };
  app.set('jsonInput', JSON.stringify(value));
  for (const indent of [0, 2, 4]) {
    app.set('jsonIndent', String(indent));
    app.click('btnJsonFormat');
    assert.equal(app.out('jsonOut'), JSON.stringify(value, null, indent));
  }
  for (const raw of ['null', 'true', '123', '"a b"', '[]', '{}']) {
    app.set('jsonInput', raw); app.click('btnJsonFormat');
    assert.equal(app.out('jsonOut'), raw);
  }
  app.set('jsonInput', '{"a":1,}'); app.click('btnJsonFormat');
  assert.match(app.out('jsonErr'), /解析错误/);
  assert.equal(app.out('jsonOut'), '');
  app.set('jsonInput', '"hello\\nworld"'); app.click('btnJsonUnescape');
  assert.equal(app.out('jsonOut'), 'hello\nworld');
});

test('非法日历日期、时间和时区不能被自动调整', (t) => {
  const app = createApp(t);
  for (const raw of ['2026-02-30', '2026-13-01', '2026-00-01', '2026-01-00', '2026-09-17 25:61:00',
    '2026-02-29T12:00:00Z', '2026-02-30T12:00:00+08:00', '2026-01-01T00:00:00+24:00', '2026-01-01T00:00:00+08:60']) {
    app.set('tsDateInput', raw); app.input('tsDateInput');
    assert.equal(app.elements.get('tsToTsOut').className, 'err', raw);
  }
});

test('日期小数秒、闰年、早期年份及显式时区', (t) => {
  const app = createApp(t);
  function millis(raw) {
    app.set('tsDateInput', raw); app.input('tsDateInput');
    const match = app.out('tsToTsOut').match(/毫秒: (-?\d+)/);
    assert.ok(match, raw + ': ' + app.out('tsToTsOut'));
    return Number(match[1]);
  }
  for (const zone of ['', 'Z', '+08:00', '-0530']) {
    assert.equal(millis('2026-09-17T12:00:00.1' + zone), millis('2026-09-17T12:00:00.100' + zone));
    assert.equal(millis('2026-09-17T12:00:00.12' + zone), millis('2026-09-17T12:00:00.120' + zone));
  }
  assert.equal(millis('2026-09-17T12:00:00+08:00'), Date.parse('2026-09-17T04:00:00Z'));
  assert.equal(millis('2024-02-29T00:00:00Z'), Date.parse('2024-02-29T00:00:00Z'));
  assert.equal(millis('0099-01-01T00:00:00Z'), Date.parse('0099-01-01T00:00:00Z'));
  millis('0099-01-01');
  assert.match(app.out('tsToTsOut'), /本地时间: 0099-01-01/);
  millis('2026-09-17T12:00:00.123');
  assert.match(app.out('tsToTsOut'), /\.123 UTC/);
});

test('时间戳可手动选择单位，并在 UTC 模式显示解析单位', (t) => {
  const app = createApp(t);
  app.set('tsInput', '86400000'); app.set('tsUnit', 'ms'); app.set('tsTz', 'utc'); app.change('tsUnit');
  assert.match(app.out('tsToDateOut'), /1970-01-02 00:00:00\.000 UTC/);
  assert.match(app.out('tsToDateOut'), /按毫秒解析/);
  app.set('tsUnit', 'sec'); app.change('tsUnit');
  assert.match(app.out('tsToDateOut'), /1972-09-27/);
  app.set('tsInput', '1694937600000'); app.set('tsUnit', 'auto'); app.input('tsInput');
  assert.match(app.out('tsToDateOut'), /按毫秒解析/);
});

test('URL 保留参数中的问号，排除片段，支持重复参数和编码字符', (t) => {
  const app = createApp(t);
  const cases = [
    ['https://example.com/?q=what?yes&x=1', ['qwhat?yes', 'x1']],
    ['https://example.com/#/page?x=1', []],
    ['?x=1&x=2&q=%E4%B8%AD%E6%96%87+%26', ['x1', 'x2', 'q中文 &']],
    ['/page?x=1#frag?y=2', ['x1']]
  ];
  for (const [raw, expected] of cases) {
    app.set('urlInput', raw); app.click('btnUrlParse');
    assert.deepEqual(app.tbody.children.map((el) => el.textContent), expected);
  }
  app.set('urlInput', 'http://['); app.click('btnUrlParse');
  assert.match(app.out('urlOut'), /无法解析 URL/);
  assert.equal(app.elements.get('urlParamsWrap').style.display, 'none');
  app.set('urlInput', '?ok=1'); app.click('btnUrlParse');
  assert.equal(app.out('urlOut'), '已解析 1 个参数');
  assert.equal(app.elements.get('urlOut').className, 'out');
});

test('Base64 失败清空旧结果，UTF-8 与 URL-safe 仍可往返', (t) => {
  const app = createApp(t);
  for (const button of ['btnB64Enc', 'btnB64Url']) {
    app.set('b64Input', '中文🙂?'); app.click(button);
    app.set('b64Input', app.out('b64Out')); app.click('btnB64Dec');
    assert.equal(app.out('b64Out'), '中文🙂?');
  }
  app.set('b64Input', '%%%'); app.click('btnB64Dec');
  assert.equal(app.out('b64Out'), '');
  assert.match(app.out('b64Err'), /解码失败/);
});

test('兼容复制接口返回失败或抛出异常时不会提示成功', async (t) => {
  for (const options of [{}, { copyThrows: true }]) {
    const app = createApp(t, options);
    app.elements.get('b64Out').textContent = 'hello';
    await app.click('btnB64Copy');
    assert.match(app.out('toast'), /复制失败/);
    assert.equal(app.copied.length, 1);
  }
});

test('原生复制成功、失败回退以及空内容反馈', async (t) => {
  let nativeText;
  const native = createApp(t, { clipboard: { async writeText(text) { nativeText = text; } } });
  native.elements.get('b64Out').textContent = '中文'; await native.click('btnB64Copy');
  assert.equal(nativeText, '中文'); assert.equal(native.copied.length, 0);
  assert.equal(native.out('toast'), '已复制到剪贴板');
  const fallback = createApp(t, { clipboard: { async writeText() { throw new Error('denied'); } }, copySucceeds: true });
  fallback.elements.get('b64Out').textContent = 'fallback'; await fallback.click('btnB64Copy');
  assert.equal(fallback.out('toast'), '已复制到剪贴板');
  assert.deepEqual(fallback.copied, ['fallback']);
  fallback.elements.get('b64Out').textContent = ''; await fallback.click('btnB64Copy');
  assert.equal(fallback.out('toast'), '内容为空，无可复制');
  assert.equal(fallback.copied.length, 1);
});

test('负号与二、八、十六进制前缀组合，保留大整数精度', (t) => {
  const app = createApp(t);
  for (const [base, raw, expected] of [['16', '-0xFF', '-255'], ['2', '-0b10', '-2'], ['8', '-0o10', '-8'],
    ['16', '-FF', '-255'], ['16', '0xFF', '255'], ['10', '9007199254740993', '9007199254740993']]) {
    app.set('baseFrom', base); app.set('baseInput', raw); app.input('baseInput');
    assert.equal(app.out('baseDec'), expected); assert.equal(app.out('baseErr'), '');
  }
  app.set('baseInput', '12ab'); app.input('baseInput');
  assert.equal(app.out('baseDec'), '—'); assert.notEqual(app.out('baseErr'), '');
});

test('正则 Worker 展示捕获组、替换并处理语法错误', async (t) => {
  const app = createApp(t);
  app.set('rePattern', '(a)(b)?'); app.set('reText', 'ab a'); app.click('btnReTest');
  await waitFor(() => app.elements.get('btnReCancel').disabled);
  assert.match(app.out('reResult'), /组1: a\n  组2: b/);
  assert.match(app.out('reResult'), /组2: \(未匹配\)/);
  app.set('reReplace', '$2$1'); app.click('btnReReplace');
  await waitFor(() => app.elements.get('btnReCancel').disabled);
  assert.equal(app.out('reReplaceOut'), 'ba a');
  app.set('rePattern', '['); app.click('btnReTest');
  await waitFor(() => app.elements.get('btnReCancel').disabled);
  assert.match(app.out('reErr'), /正则错误/); assert.equal(app.out('reResult'), '');
});

test('正则空匹配与大量结果不会无限收集', async (t) => {
  const app = createApp(t);
  app.set('rePattern', '(?:)'); app.set('reText', 'a'.repeat(2000)); app.click('btnReTest');
  await waitFor(() => app.elements.get('btnReCancel').disabled);
  assert.match(app.out('reErr'), /仅展示前 1000/);
  assert.equal((app.out('reResult').match(/^#/gm) || []).length, 1000);
});

test('灾难性回溯的匹配与替换自动超时，随后仍能正常使用', async (t) => {
  const app = createApp(t);
  app.set('rePattern', '(a+)+$'); app.set('reText', 'a'.repeat(28) + '!');
  for (const button of ['btnReTest', 'btnReReplace']) {
    app.click(button);
    await waitFor(() => app.elements.get('btnReCancel').disabled);
    assert.match(app.out('reErr'), /执行超过 1 秒/);
  }
  app.set('rePattern', 'a'); app.set('reText', 'abc'); app.click('btnReTest');
  await waitFor(() => app.elements.get('btnReCancel').disabled);
  assert.match(app.out('reResult'), /"a"/); assert.equal(app.out('reErr'), '');
});

test('取消任务、更新输入和替换旧任务均不会留下过期结果', async (t) => {
  const app = createApp(t);
  app.set('rePattern', '(a+)+$'); app.set('reText', 'a'.repeat(28) + '!'); app.click('btnReTest');
  app.click('btnReCancel'); assert.equal(app.out('reErr'), '已取消');
  app.click('btnReTest'); app.set('rePattern', 'b'); app.input('rePattern');
  assert.equal(app.elements.get('btnReCancel').disabled, true); assert.equal(app.out('reResult'), '—');
  app.set('reText', 'abc'); app.click('btnReTest'); app.set('rePattern', 'c'); app.click('btnReTest');
  await waitFor(() => app.elements.get('btnReCancel').disabled);
  assert.equal(app.out('reResult'), '#1 [2] "c"');
});

test('Worker 不可用时明确报错，不回退到阻塞界面的执行方式', (t) => {
  const app = createApp(t, { workerUnavailable: true });
  app.set('rePattern', 'a'); app.set('reText', 'abc'); app.click('btnReTest');
  assert.match(app.out('reErr'), /无法启动正则任务/);
  assert.equal(app.elements.get('btnReCancel').disabled, true);
});

test('哈希分块边界、UTF-8 与 UUID 保持正确', (t) => {
  const app = createApp(t);
  const samples = ['', 'abc', '中文🙂', '\0\r\n', ...Array.from({ length: 141 }, (_, i) => 'x'.repeat(i)), crypto.randomBytes(4096).toString('base64')];
  for (const [button, algo] of [['btnMd5', 'md5'], ['btnSha1', 'sha1'], ['btnSha256', 'sha256']]) {
    for (const value of samples) {
      app.set('hashInput', value); app.click(button);
      assert.equal(app.out('hashOut'), crypto.createHash(algo).update(value).digest('hex'));
    }
  }
  app.set('uuidCount', '500'); app.click('btnUuid');
  const ids = app.out('uuidOut').split('\n');
  assert.equal(ids.length, 500); assert.equal(new Set(ids).size, 500);
  assert.ok(ids.every((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)));
});
