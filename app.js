/* DevTools 开发工具箱 — 全部逻辑（纯前端，无外部依赖，离线可用） */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  /* ---------- 通用工具 ---------- */
  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function fallbackCopy(text) {
    const active = document.activeElement;
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.top = '-9999px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    try {
      ta.focus();
      ta.select();
      return document.execCommand('copy') === true;
    } catch (e) {
      return false;
    } finally {
      document.body.removeChild(ta);
      if (active) active.focus();
    }
  }
  async function copyText(text) {
    if (!text) { showToast('内容为空，无可复制'); return; }
    let copied = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        copied = true;
      }
    } catch (e) {
      // 剪贴板接口不可用时，继续尝试兼容方式。
    }
    if (!copied) copied = fallbackCopy(text);
    showToast(copied ? '已复制到剪贴板' : '复制失败，请选中结果后按 ⌘C');
  }
  let toastTimer = null;
  function showToast(msg) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 1600);
  }

  /* ---------- 1. 导航切换 ---------- */
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach((btn) => {
    btn.addEventListener('click', () => {
      navItems.forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      const panel = document.querySelector('.panel[data-tool="' + btn.dataset.tool + '"]');
      if (panel) panel.classList.add('active');
    });
  });

  /* ---------- 2. 时间戳 ---------- */
  const tsNowSec = $('tsNowSec'), tsNowMs = $('tsNowMs'), tsNowLocal = $('tsNowLocal'), tsNowUtc = $('tsNowUtc');
  const tsInput = $('tsInput'), tsUnit = $('tsUnit'), tsTz = $('tsTz'), tsToDateOut = $('tsToDateOut');
  const tsDateInput = $('tsDateInput'), tsToTsOut = $('tsToTsOut'), tsDateNote = $('tsDateNote');

  function tick() {
    const now = Date.now();
    tsNowSec.textContent = Math.floor(now / 1000);
    tsNowMs.textContent = now;
    tsNowLocal.textContent = new Date(now).toLocaleString('zh-CN', { hour12: false });
    tsNowUtc.textContent = new Date(now).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
  }
  function tsToDate() {
    const v = tsInput.value.trim();
    if (!v) { tsToDateOut.textContent = '—'; tsToDateOut.className = 'out'; return; }
    const n = Number(v);
    if (!Number.isFinite(n)) { tsToDateOut.textContent = '无效时间戳'; tsToDateOut.className = 'err'; return; }
    // 按数值量级判断单位（比按字符串长度可靠，可正确处理负数/科学计数法）：
    // 秒级时间戳约 1e9，毫秒级约 1e12；以 1e11 为分界。
    const isSec = tsUnit.value === 'sec' || (tsUnit.value === 'auto' && Math.abs(n) < 1e11);
    const ms = isSec ? n * 1000 : n;
    const d = new Date(ms);
    if (isNaN(d.getTime())) { tsToDateOut.textContent = '无效时间戳'; tsToDateOut.className = 'err'; return; }
    tsToDateOut.className = 'out';
    const unit = isSec ? '秒' : '毫秒';
    const utcStr = d.toISOString().replace('T', ' ').replace('Z', ' UTC');
    const unitNote = '\n（' + (tsUnit.value === 'auto' ? '自动识别，' : '') + '按' + unit + '解析）';
    if (tsTz.value === 'utc') {
      tsToDateOut.textContent = utcStr + unitNote;
    } else {
      tsToDateOut.textContent = new Date(ms).toLocaleString('zh-CN', { hour12: false }) +
        '\n' + utcStr + unitNote;
    }
  }
  /* 统一日期解析：显式带时区(Z/±HH:MM)则尊重之，否则一律按本地时区解析。
     规避 JS 原生 new Date("2026-09-17") 按 UTC 解析、而
     new Date("2026-09-17T00:00:00") 按本地解析造成的同工具内不一致。 */
  function parseDateInput(v) {
    const invalid = () => ({ d: new Date(NaN), note: '' });
    const m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:?\d{2})?)?$/i);
    if (!m) {
      // ISO 风格输入必须严格校验，不能回退到会自动调整非法日期的系统解析。
      return /^\d{4}-/.test(v) ? invalid() : { d: new Date(v), note: '按系统默认规则解析' };
    }
    const [year, month, day, hour, minute, second] = m.slice(1, 7).map((x) => Number(x || 0));
    const millis = Number((m[7] || '').padEnd(3, '0'));
    if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) return invalid();
    // 先以 UTC 检查日历字段，避免 Date 自动把 2 月 30 日调整到 3 月。
    // setUTCFullYear 同时避免构造函数把 0～99 年解释成 1900～1999 年。
    const calendar = new Date(0);
    calendar.setUTCFullYear(year, month - 1, day);
    calendar.setUTCHours(hour, minute, second, millis);
    if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) return invalid();
    if (m[8]) {
      const zone = m[8];
      let offset = 0;
      if (zone.toUpperCase() !== 'Z') {
        const parts = zone.slice(1).replace(':', '');
        const h = Number(parts.slice(0, 2)), min = Number(parts.slice(2));
        if (h > 23 || min > 59) return invalid();
        offset = (h * 60 + min) * (zone[0] === '+' ? 1 : -1);
      }
      return { d: new Date(calendar.getTime() - offset * 60000), note: '按输入中指定的时区解析' };
    }
    const d = new Date(0);
    d.setFullYear(year, month - 1, day);
    d.setHours(hour, minute, second, millis);
    // 夏令时跳变造成的不存在的本地时间也应报错。
    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day ||
        d.getHours() !== hour || d.getMinutes() !== minute || d.getSeconds() !== second) return invalid();
    return { d, note: m[4] ? '无时区信息，按本地时区解析' : '纯日期，按本地时区 00:00:00 解析' };
  }
  function dateToTs() {
    const v = tsDateInput.value.trim();
    if (!v) { tsToTsOut.textContent = '—'; tsToTsOut.className = 'out'; tsDateNote.textContent = ''; return; }
    const parsed = parseDateInput(v);
    const d = parsed.d;
    if (isNaN(d.getTime())) {
      tsToTsOut.textContent = '无法解析日期（支持 YYYY-MM-DD、YYYY-MM-DD HH:mm:ss、ISO 8601）';
      tsToTsOut.className = 'err'; tsDateNote.textContent = '';
      return;
    }
    tsToTsOut.className = 'out';
    const p = (n) => String(n).padStart(2, '0');
    const localStr = String(d.getFullYear()).padStart(4, '0') + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' +
      p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
    tsToTsOut.textContent =
      '秒级: ' + Math.floor(d.getTime() / 1000) +
      '\n毫秒: ' + d.getTime() +
      '\n本地时间: ' + localStr +
      '\nUTC: ' + d.toISOString().replace('T', ' ').replace('Z', ' UTC');
    tsDateNote.textContent = parsed.note;
  }
  tsInput.addEventListener('input', tsToDate);
  tsUnit.addEventListener('change', tsToDate);
  tsTz.addEventListener('change', tsToDate);
  tsDateInput.addEventListener('input', dateToTs);
  $('tsNowFill').addEventListener('click', () => {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    tsDateInput.value = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
    dateToTs();
  });
  setInterval(tick, 1000); tick();

  /* ---------- 3. JSON ---------- */
  const jsonInput = $('jsonInput'), jsonIndent = $('jsonIndent'), jsonOut = $('jsonOut'), jsonErr = $('jsonErr');
  function syntaxHighlight(json) {
    json = escapeHtml(json);
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
      let cls = 'num';
      if (/^"/.test(match)) { cls = /:$/.test(match) ? 'key' : 'str'; }
      else if (/true|false/.test(match)) cls = 'bool';
      else if (/null/.test(match)) cls = 'null';
      return '<span class="' + cls + '">' + match + '</span>';
    });
  }
  function formatJson(txt, indent) {
    // 只用原生解析器校验语法；输出直接重排原始 token，保留数字精度和重复键。
    JSON.parse(txt);
    const tokens = txt.match(/"(?:\\[\s\S]|[^"\\])*"|[^\s{}\[\]:,]+|[{}\[\]:,]/g);
    const out = [];
    let depth = 0;
    const newline = () => { if (indent) out.push('\n' + ' '.repeat(depth * indent)); };
    tokens.forEach((token, i) => {
      if (token === '{' || token === '[') {
        out.push(token);
        depth++;
        if (tokens[i + 1] !== '}' && tokens[i + 1] !== ']') newline();
      } else if (token === '}' || token === ']') {
        depth--;
        if (tokens[i - 1] !== '{' && tokens[i - 1] !== '[') newline();
        out.push(token);
      } else if (token === ',') {
        out.push(token);
        newline();
      } else {
        out.push(token === ':' && indent ? ': ' : token);
      }
    });
    return out.join('');
  }
  function jsonDo(mode) {
    const txt = jsonInput.value;
    if (!txt.trim()) { jsonErr.textContent = ''; jsonOut.textContent = ''; return; }
    try {
      if (mode === 'escape') {
        jsonOut.textContent = JSON.stringify(txt);
        jsonOut.className = 'json';
      } else if (mode === 'unescape') {
        const out = txt.trim().startsWith('"') ? JSON.parse(txt) : formatJson(txt, 2);
        jsonOut.textContent = out; jsonOut.className = 'json';
      } else {
        // 注意：0 是合法缩进值（完全紧凑），不能用 || 兜底，否则会被误判为 2
        const parsedIndent = parseInt(jsonIndent.value, 10);
        const indent = Number.isNaN(parsedIndent) ? 2 : Math.max(0, Math.min(10, parsedIndent));
        const out = formatJson(txt, mode === 'min' ? 0 : indent);
        jsonOut.innerHTML = mode === 'min' ? escapeHtml(out) : syntaxHighlight(out);
        jsonOut.className = 'json';
      }
      jsonErr.textContent = '';
    } catch (e) {
      jsonErr.textContent = '解析错误: ' + e.message;
      jsonOut.textContent = '';
    }
  }
  $('btnJsonFormat').addEventListener('click', () => jsonDo('format'));
  $('btnJsonMin').addEventListener('click', () => jsonDo('min'));
  $('btnJsonEscape').addEventListener('click', () => jsonDo('escape'));
  $('btnJsonUnescape').addEventListener('click', () => jsonDo('unescape'));
  $('btnJsonCopy').addEventListener('click', () => copyText(jsonOut.textContent));

  /* ---------- 4. URL ---------- */
  const urlInput = $('urlInput'), urlOut = $('urlOut'), urlParamsWrap = $('urlParamsWrap');
  function urlDo(mode) {
    const t = urlInput.value;
    try {
      if (mode === 'encC') urlOut.textContent = encodeURIComponent(t);
      else if (mode === 'decC') urlOut.textContent = decodeURIComponent(t);
      else if (mode === 'enc') urlOut.textContent = encodeURI(t);
      else if (mode === 'dec') urlOut.textContent = decodeURI(t);
      urlOut.className = 'out';
    } catch (e) {
      urlOut.className = 'err';
      urlOut.textContent = '解码失败: ' + e.message;
    }
  }
  function urlParse() {
    const t = urlInput.value;
    const tb = document.querySelector('#urlParams tbody');
    tb.innerHTML = '';
    let params;
    try {
      // 同时支持完整 URL、相对地址和 ?key=value；片段中的 ? 不属于 Query。
      params = new URL(t, 'https://devtools.invalid/').searchParams;
    } catch (e) {
      urlParamsWrap.style.display = 'none';
      urlOut.className = 'err';
      urlOut.textContent = '无法解析 URL: ' + e.message;
      return;
    }
    let count = 0;
    params.forEach((v, k) => {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td class="mono">' + escapeHtml(k) + '</td><td class="mono">' + escapeHtml(v) + '</td>';
      tb.appendChild(tr);
      count++;
    });
    if (count === 0) tb.innerHTML = '<tr><td colspan="2" style="color:var(--muted)">无参数</td></tr>';
    urlOut.className = 'out';
    urlOut.textContent = '已解析 ' + count + ' 个参数';
    urlParamsWrap.style.display = 'block';
  }
  $('btnUrlEncC').addEventListener('click', () => urlDo('encC'));
  $('btnUrlDecC').addEventListener('click', () => urlDo('decC'));
  $('btnUrlEnc').addEventListener('click', () => urlDo('enc'));
  $('btnUrlDec').addEventListener('click', () => urlDo('dec'));
  $('btnUrlParse').addEventListener('click', urlParse);

  /* ---------- 5. Base64 ---------- */
  const b64Input = $('b64Input'), b64Out = $('b64Out'), b64Err = $('b64Err');
  function b64encode(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }
  function b64decode(b64) {
    b64 = b64.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  function b64Enc(urlSafe) {
    try {
      let s = b64encode(b64Input.value);
      if (urlSafe) s = s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      b64Out.textContent = s; b64Err.textContent = ''; b64Out.className = 'out';
    } catch (e) { b64Out.textContent = ''; b64Err.textContent = e.message; }
  }
  function b64Dec() {
    try {
      b64Out.textContent = b64decode(b64Input.value.trim());
      b64Err.textContent = ''; b64Out.className = 'out';
    } catch (e) { b64Out.textContent = ''; b64Out.className = 'out'; b64Err.textContent = '解码失败：不是有效的 Base64'; }
  }
  $('btnB64Enc').addEventListener('click', () => b64Enc(false));
  $('btnB64Url').addEventListener('click', () => b64Enc(true));
  $('btnB64Dec').addEventListener('click', b64Dec);
  $('btnB64Copy').addEventListener('click', () => copyText(b64Out.textContent));

  /* ---------- 6. UUID ---------- */
  const uuidCount = $('uuidCount'), uuidOut = $('uuidOut');
  function uuidv4() {
    const b = new Uint8Array(16);
    crypto.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = Array.from(b).map((x) => x.toString(16).padStart(2, '0'));
    return h[0] + h[1] + h[2] + h[3] + '-' + h[4] + h[5] + '-' + h[6] + h[7] + '-' + h[8] + h[9] + '-' + h[10] + h[11] + h[12] + h[13] + h[14] + h[15];
  }
  $('btnUuid').addEventListener('click', () => {
    const n = Math.min(500, Math.max(1, parseInt(uuidCount.value, 10) || 1));
    const arr = [];
    for (let i = 0; i < n; i++) arr.push(uuidv4());
    uuidOut.textContent = arr.join('\n');
  });
  $('btnUuidCopy').addEventListener('click', () => copyText(uuidOut.textContent));

  /* ---------- 7. 正则 ---------- */
  const rePattern = $('rePattern'), reFlags = $('reFlags'), reText = $('reText');
  const reResult = $('reResult'), reReplace = $('reReplace'), reReplaceOut = $('reReplaceOut'), reErr = $('reErr');
  const reCancel = $('btnReCancel');
  let regexJob = null;
  // 函数整体作为离线 Blob Worker 执行，不捕获页面变量，也不在界面线程运行正则。
  function regexWorker() {
    self.onmessage = ({ data }) => {
      const { operation, pattern, flags, text, replacement } = data;
      try {
        const re = new RegExp(pattern, operation === 'test' && !flags.includes('g') ? flags + 'g' : flags);
        if (operation === 'replace') {
          const result = text.replace(re, replacement);
          if (result.length > 1000000) throw new Error('替换结果超过 100 万字符，请缩小输入或调整替换内容');
          self.postMessage({ result });
          return;
        }
        const lines = [];
        let size = 0, truncated = false;
        const preview = (value) => value.length > 1000 ? value.slice(0, 1000) + '…（已截断）' : value;
        for (const m of text.matchAll(re)) {
          if (lines.length === 1000) { truncated = true; break; }
          const groups = m.slice(1).map((g, j) => '  组' + (j + 1) + ': ' + (g === undefined ? '(未匹配)' : preview(g)));
          const line = '#' + (lines.length + 1) + ' [' + m.index + '] "' + preview(m[0]) + '"' + (groups.length ? '\n' + groups.join('\n') : '');
          lines.push(line.slice(0, 100000 - size));
          size += line.length + 2;
          if (size >= 100000) { truncated = true; break; }
        }
        self.postMessage({ result: lines.length ? lines.join('\n\n') : '无匹配', truncated });
      } catch (e) {
        self.postMessage({ error: e.message });
      }
    };
  }
  function stopRegex() {
    if (!regexJob) return;
    regexJob.worker.terminate();
    clearTimeout(regexJob.timer);
    URL.revokeObjectURL(regexJob.url);
    regexJob = null;
    reCancel.disabled = true;
  }
  function runRegex(operation) {
    stopRegex();
    const output = operation === 'test' ? reResult : reReplaceOut;
    reResult.textContent = '—';
    reReplaceOut.textContent = '';
    reReplaceOut.style.display = operation === 'replace' ? 'block' : 'none';
    reErr.textContent = '';
    if (!rePattern.value) { reErr.textContent = '请输入正则表达式'; return; }
    if (reText.value.length > 1000000) { reErr.textContent = '测试文本不能超过 100 万字符'; return; }
    let url;
    try {
      url = URL.createObjectURL(new Blob(['(' + regexWorker.toString() + ')()'], { type: 'text/javascript' }));
      const worker = new Worker(url);
      const job = { worker, url, timer: null, output };
      regexJob = job;
      reCancel.disabled = false;
      output.textContent = '处理中…';
      worker.onmessage = ({ data }) => {
        if (regexJob !== job) return;
        stopRegex();
        output.textContent = data.error ? '' : data.result;
        reErr.textContent = data.error ? '正则错误: ' + data.error : (data.truncated ? '结果过多，仅展示前 1000 个匹配或前 10 万字符' : '');
      };
      worker.onerror = (event) => {
        event.preventDefault();
        if (regexJob !== job) return;
        stopRegex();
        output.textContent = '';
        reErr.textContent = '正则任务执行失败，请重试';
      };
      job.timer = setTimeout(() => {
        if (regexJob !== job) return;
        stopRegex();
        output.textContent = '';
        reErr.textContent = '执行超过 1 秒，已停止。请简化表达式或缩短文本';
      }, 1000);
      worker.postMessage({ operation, pattern: rePattern.value, flags: reFlags.value, text: reText.value, replacement: reReplace.value });
    } catch (e) {
      stopRegex();
      if (url) URL.revokeObjectURL(url);
      output.textContent = '';
      reErr.textContent = '无法启动正则任务: ' + e.message;
    }
  }
  $('btnReTest').addEventListener('click', () => runRegex('test'));
  $('btnReReplace').addEventListener('click', () => runRegex('replace'));
  reCancel.addEventListener('click', () => {
    const output = regexJob && regexJob.output;
    stopRegex();
    if (output) { output.textContent = ''; reErr.textContent = '已取消'; }
  });
  // 输入改变后终止旧任务，避免旧结果覆盖新输入对应的状态。
  [rePattern, reFlags, reText, reReplace].forEach((el) => el.addEventListener('input', () => {
    stopRegex();
    reResult.textContent = '—';
    reReplaceOut.textContent = '';
    reReplaceOut.style.display = 'none';
    reErr.textContent = '';
  }));

  /* ---------- 8. 颜色 ---------- */
  const colorHex = $('colorHex'), colorPicker = $('colorPicker'), colorPreview = $('colorPreview');
  const colorRgb = $('colorRgb'), colorHsl = $('colorHsl'), colorCss = $('colorCss'), colorErr = $('colorErr');
  const rgbR = $('rgbR'), rgbG = $('rgbG'), rgbB = $('rgbB'), rgbToHexOut = $('rgbToHexOut');
  function hexToRgb(hex) {
    hex = hex.replace('#', '');
    return { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16) };
  }
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) { h = s = 0; }
    else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        default: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
  }
  function applyColor() {
    let hex = colorHex.value.trim();
    if (!hex.startsWith('#')) hex = '#' + hex;
    if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex)) {
      // 给出明确反馈，而不是静默无响应
      colorRgb.textContent = '—';
      colorHsl.textContent = '—';
      colorCss.textContent = '—';
      colorErr.textContent = hex === '#' ? '' : '请输入合法的 HEX，如 #0071e3 或 #fff';
      return;
    }
    colorErr.textContent = '';
    if (hex.length === 4) hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
    const rgb = hexToRgb(hex);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    colorRgb.textContent = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    colorHsl.textContent = `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
    colorCss.textContent = `background: ${hex};`;
    colorPreview.style.background = hex;
    colorPicker.value = hex;
  }
  colorHex.addEventListener('input', applyColor);
  colorPicker.addEventListener('input', () => { colorHex.value = colorPicker.value; applyColor(); });
  $('btnColorApply').addEventListener('click', applyColor);
  $('btnRgbToHex').addEventListener('click', () => {
    const raw = [rgbR.value, rgbG.value, rgbB.value];
    // 注意：Number('') === 0，不能用 +v 判断，否则留空会静默变成 #000000
    if (raw.some((x) => x.trim() === '')) {
      rgbToHexOut.textContent = '请填写完整的 R、G、B 三个值';
      rgbToHexOut.className = 'err';
      return;
    }
    const nums = raw.map((x) => Number(x));
    if (nums.some((x) => !Number.isFinite(x) || !Number.isInteger(x))) {
      rgbToHexOut.textContent = 'R、G、B 需为整数';
      rgbToHexOut.className = 'err';
      return;
    }
    if (nums.some((x) => x < 0 || x > 255)) {
      rgbToHexOut.textContent = 'RGB 取值范围 0-255';
      rgbToHexOut.className = 'err';
      return;
    }
    rgbToHexOut.className = 'out';
    rgbToHexOut.textContent = '#' + nums.map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase();
  });

  /* ---------- 9. 进制 ---------- */
  const baseInput = $('baseInput'), baseFrom = $('baseFrom'), baseErr = $('baseErr');
  const baseBin = $('baseBin'), baseOct = $('baseOct'), baseDec = $('baseDec'), baseHex = $('baseHex');

  /* 用 BigInt 解析：支持任意精度（parseInt 超过 2^53 会丢精度），
     并对非法字符严格报错（parseInt("12ab",10) 会静默截断成 12）。 */
  function parseBigInt(str, base) {
    const digits = '0123456789abcdefghijklmnopqrstuvwxyz';
    let s = str.trim().toLowerCase();
    // 先处理符号，再处理前缀，确保 -0xFF / -0b10 / -0o10 也能解析。
    const neg = s[0] === '-';
    if (neg) s = s.slice(1);
    // 容忍常见前缀：0b / 0o / 0x
    const prefix = { 2: '0b', 8: '0o', 16: '0x' }[base];
    if (prefix && s.startsWith(prefix)) s = s.slice(2);
    if (s === '') return { error: '请输入数值' };
    let acc = 0n;
    const B = BigInt(base);
    for (const ch of s) {
      const d = digits.indexOf(ch);
      if (d < 0 || d >= base) {
        const set = base === 10 ? '0-9' : base === 2 ? '0-1' : base === 8 ? '0-7' : '0-9 / a-f';
        return { error: `「${ch}」不是合法的 ${base} 进制字符（仅允许 ${set}）` };
      }
      acc = acc * B + BigInt(d);
    }
    if (neg) acc = -acc;
    return { value: acc };
  }
  function convertBase() {
    const val = baseInput.value;
    const from = parseInt(baseFrom.value, 10);
    const clear = () => { [baseBin, baseOct, baseDec, baseHex].forEach((e) => (e.textContent = '—')); };
    if (val.trim() === '') {
      clear();
      if (baseErr) baseErr.textContent = '';
      return;
    }
    const r = parseBigInt(val, from);
    if (r.error) {
      clear();
      if (baseErr) baseErr.textContent = r.error;
      return;
    }
    if (baseErr) baseErr.textContent = '';
    const n = r.value;
    baseBin.textContent = n.toString(2);
    baseOct.textContent = n.toString(8);
    baseDec.textContent = n.toString(10);
    baseHex.textContent = n.toString(16).toUpperCase();
  }
  baseInput.addEventListener('input', convertBase);
  baseFrom.addEventListener('change', convertBase);

  /* ---------- 10. 哈希 (纯 JS 实现，file:// 下 crypto.subtle 不可用) ---------- */
  const hashInput = $('hashInput'), hashOut = $('hashOut');
  function md5Bytes(input) {
    const s = [7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,
               5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,
               4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,
               6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21];
    const K = new Int32Array(64);
    for (let i = 0; i < 64; i++) K[i] = (Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296)) | 0;
    const origLenBits = input.length * 8;
    const withOne = input.length + 1;
    const padK = (56 - (withOne % 64) + 64) % 64;
    const total = withOne + padK + 8;
    const msg = new Uint8Array(total);
    msg.set(input); msg[input.length] = 0x80;
    const dv = new DataView(msg.buffer);
    dv.setUint32(total - 8, origLenBits >>> 0, true);
    dv.setUint32(total - 4, Math.floor(origLenBits / 0x100000000), true);
    let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
    const M = new Int32Array(16);
    const rotl = (x, n) => (x << n) | (x >>> (32 - n));
    for (let off = 0; off < total; off += 64) {
      for (let i = 0; i < 16; i++) M[i] = dv.getInt32(off + i * 4, true);
      let A = a0, B = b0, C = c0, D = d0;
      for (let i = 0; i < 64; i++) {
        let F, g;
        if (i < 16) { F = (B & C) | (~B & D); g = i; }
        else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
        else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
        else { F = C ^ (B | ~D); g = (7 * i) % 16; }
        F = (F + A + K[i] + M[g]) | 0;
        A = D; D = C; C = B; B = (B + rotl(F, s[i])) | 0;
      }
      a0 = (a0 + A) | 0; b0 = (b0 + B) | 0; c0 = (c0 + C) | 0; d0 = (d0 + D) | 0;
    }
    const leHex = (n) => ((n >>> 0) & 0xff).toString(16).padStart(2, '0') +
      ((n >>> 8) & 0xff).toString(16).padStart(2, '0') +
      ((n >>> 16) & 0xff).toString(16).padStart(2, '0') +
      ((n >>> 24) & 0xff).toString(16).padStart(2, '0');
    return leHex(a0) + leHex(b0) + leHex(c0) + leHex(d0);
  }
  function sha1Bytes(bytes) {
    const H = new Uint32Array([0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476, 0xC3D2E1F0]);
    const l = bytes.length, bitLen = l * 8;
    const withOne = l + 1, k = (56 - (withOne % 64) + 64) % 64, total = withOne + k + 8;
    const msg = new Uint8Array(total); msg.set(bytes); msg[l] = 0x80;
    const dv = new DataView(msg.buffer);
    dv.setUint32(total - 4, bitLen >>> 0, false);
    dv.setUint32(total - 8, Math.floor(bitLen / 0x100000000), false);
    const w = new Uint32Array(80);
    const rotl = (x, n) => (x << n) | (x >>> (32 - n));
    for (let off = 0; off < total; off += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4, false);
      for (let i = 16; i < 80; i++) w[i] = rotl(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
      let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4];
      for (let i = 0; i < 80; i++) {
        let f, kk;
        if (i < 20) { f = (b & c) | (~b & d); kk = 0x5A827999; }
        else if (i < 40) { f = b ^ c ^ d; kk = 0x6ED9EBA1; }
        else if (i < 60) { f = (b & c) | (b & d) | (c & d); kk = 0x8F1BBCDC; }
        else { f = b ^ c ^ d; kk = 0xCA62C1D6; }
        const temp = ((rotl(a, 5) + f + e + kk + w[i]) | 0);
        e = d; d = c; c = rotl(b, 30); b = a; a = temp | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0; H[4] = (H[4] + e) | 0;
    }
    return Array.from(H).map((x) => (x >>> 0).toString(16).padStart(8, '0')).join('');
  }
  function sha256Bytes(bytes) {
    const K = new Uint32Array([
      0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
      0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
      0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
      0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
      0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
      0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
      0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
      0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
    const H = new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
    const l = bytes.length, bitLen = l * 8;
    const withOne = l + 1, k = (56 - (withOne % 64) + 64) % 64, total = withOne + k + 8;
    const msg = new Uint8Array(total); msg.set(bytes); msg[l] = 0x80;
    const dv = new DataView(msg.buffer);
    dv.setUint32(total - 4, bitLen >>> 0, false);
    dv.setUint32(total - 8, Math.floor(bitLen / 0x100000000), false);
    const w = new Uint32Array(64);
    const rotr = (x, n) => (x >>> n) | (x << (32 - n));
    for (let off = 0; off < total; off += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4, false);
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (let i = 0; i < 64; i++) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const ch = (e & f) ^ (~e & g);
        const t1 = (h + S1 + ch + K[i] + w[i]) | 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + maj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    return Array.from(H).map((x) => (x >>> 0).toString(16).padStart(8, '0')).join('');
  }
  function hashDo(algo) {
    const bytes = new TextEncoder().encode(hashInput.value);
    let out = '';
    if (algo === 'md5') out = md5Bytes(bytes);
    else if (algo === 'sha1') out = sha1Bytes(bytes);
    else if (algo === 'sha256') out = sha256Bytes(bytes);
    hashOut.textContent = out;
  }
  $('btnMd5').addEventListener('click', () => hashDo('md5'));
  $('btnSha1').addEventListener('click', () => hashDo('sha1'));
  $('btnSha256').addEventListener('click', () => hashDo('sha256'));
  $('btnHashCopy').addEventListener('click', () => copyText(hashOut.textContent));

  /* ---------- 11. 文本处理 ---------- */
  const textInput = $('textInput'), textOut = $('textOut'), textStat = $('textStat');
  let textHasResult = false;
  function updateTextStat(t) {
    const chars = t.length;
    // 行数：忽略末尾单个换行，使 "a\nb\n" 计为 2 行（符合编辑器直觉）
    const lines = t === '' ? 0 : t.replace(/(?:\r\n|\r|\n)$/, '').split(/\r\n|\r|\n/).length;
    const words = (t.match(/[一-龥]|[A-Za-z0-9]+/g) || []).length;
    textStat.innerHTML =
      '<div class="item"><div class="num">' + chars + '</div><div class="lbl">字符数</div></div>' +
      '<div class="item"><div class="num">' + lines + '</div><div class="lbl">行数</div></div>' +
      '<div class="item"><div class="num">' + words + '</div><div class="lbl">词数(中/英)</div></div>';
  }
  function textDo(op) {
    const raw = textInput.value;
    const lines = raw.split(/\r\n|\r|\n/);
    let out;
    switch (op) {
      case 'upper': out = raw.toUpperCase(); break;
      case 'lower': out = raw.toLowerCase(); break;
      case 'trim': out = lines.map((l) => l.replace(/^\s+|\s+$/g, '').replace(/[ \t]+/g, ' ')).join('\n'); break;
      case 'rmempty': out = lines.filter((l) => l.trim() !== '').join('\n'); break;
      case 'dedup': out = Array.from(new Set(lines)).join('\n'); break;
      case 'sort': out = lines.slice().sort((a, b) => a.localeCompare(b, 'zh')).join('\n'); break;
      case 'lf': out = lines.join('\n'); break;
      case 'crlf': out = lines.join('\r\n'); break;
      default: out = raw;
    }
    textOut.textContent = out;
    textHasResult = true;
    updateTextStat(out);
  }
  ['btnUpper','btnLower','btnTrim','btnRmEmpty','btnDedup','btnSort','btnLf','btnCrlf'].forEach((id) => {
    const map = { btnUpper: 'upper', btnLower: 'lower', btnTrim: 'trim', btnRmEmpty: 'rmempty', btnDedup: 'dedup', btnSort: 'sort', btnLf: 'lf', btnCrlf: 'crlf' };
    $(id).addEventListener('click', () => textDo(map[id]));
  });
  // 实时统计：边输入边更新
  textInput.addEventListener('input', () => updateTextStat(textInput.value));
  // 链式处理：把上一步结果回填到输入，便于连续多次变换
  $('btnTextBack').addEventListener('click', () => {
    if (!textHasResult) return;
    textInput.value = textOut.textContent;
    updateTextStat(textInput.value);
  });
  $('btnTextCopy').addEventListener('click', () => copyText(textOut.textContent));

  /* ---------- 初始化 ---------- */
  applyColor();
  convertBase();
  updateTextStat('');
})();
