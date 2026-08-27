// preview.mjs · 开局页/状态栏本地预览（development_only，不进卡）
// 用法：node scripts/preview.mjs [端口]    默认 8787
// 访问：http://localhost:8787/preview    （开局页预览）
//       http://localhost:8787/status     （状态栏预览：模拟 TH 楼层 iframe 的 MVU 环境）
// 说明：真实环境里 opening-page.html / statusbar.html 由酒馆助手渲染器注入 TH-message iframe 运行，
//       predefine.js 提供 window.SillyTavern / 世界书 API / MVU 变量 API。本脚本用最小模拟层复现该环境，
//       便于预览与美化调试。
//       控制条固定在页面底部：宽度 / 高度 / 内容缩放 三组档位；320 = ST 聊天消息实际宽度。
//       模拟数据均带「预览占位」标注，不构成卡面内容。
// 铁律：本脚本只读 source/，不修改任何源文件。

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2] || process.env.PORT || 8787);

// 从 opening-page.html 剥离 markdown 围栏与标记，取围栏内完整 HTML 文档
function extractPage() {
  const src = fs.readFileSync(path.join(root, 'source/ui/opening-page.html'), 'utf8');
  const m = src.match(/<!--gg-opening-begin-->\s*```html\s*([\s\S]*?)```\s*<!--gg-opening-end-->/);
  if (!m) throw new Error('opening-page.html 围栏结构异常（缺 begin/end 标记或 ```html 围栏）');
  return m[1];
}

// 预览壳：顶部提示 + 大画布（内容垂直居中）+ 底部固定控制条（宽度/高度/缩放）
// 注意：模拟环境脚本必须放在开局页文档之前（开局页 IIFE 解析时即执行）。
// 剥离后的页面经检查不含反引号，可直接嵌入模板字符串。
function previewShell(page) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>开局页预览 · 中元特供·关公</title>
<style>
  html,body{margin:0;padding:0;background:#0e0b08}
  body{font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Microsoft YaHei",sans-serif;padding:14px 10px 96px}
  .gg-pv-note{max-width:720px;margin:0 auto 12px;padding:8px 14px;border:1px dashed #5a4a33;border-radius:8px;background:#151009;color:#a99575;font-size:12px;line-height:1.7}
  .gg-pv-note b{color:#c9a24b}
  .gg-pv-frame{max-width:720px;margin:0 auto;display:flex;justify-content:center}
  .gg-pv-canvas{display:flex;align-items:center;justify-content:center;min-height:800px;padding:28px 16px;background:
      radial-gradient(80% 60% at 25% -5%,rgba(90,110,200,.20),transparent 60%),
      radial-gradient(70% 60% at 85% 25%,rgba(120,80,190,.14),transparent 60%),
      linear-gradient(180deg,#0a0e22,#04060f);border:1px solid #1c2340;border-radius:10px}
  .gg-pv-ctl{position:fixed;left:0;right:0;bottom:0;z-index:10;padding:10px 14px;background:#14100c;border-top:1px solid #2a2016;color:#a99575;font-size:12px;line-height:1.9}
  .gg-pv-ctl .gg-pv-row{max-width:720px;margin:0 auto;display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px}
  .gg-pv-ctl .gg-pv-lab{color:#c9a24b}
  .gg-pv-ctl #ggPvState{color:#8a7a5c}
  .gg-pv-wbtn{display:inline-block;min-width:44px;margin:0;padding:2px 8px;border:1px solid #5a4a33;border-radius:6px;background:transparent;color:#c9a24b;font:inherit;font-size:12px;cursor:pointer}
  .gg-pv-wbtn:hover,.gg-pv-wbtn.on{border-color:#c9a24b;background:#2a2016}
</style>
</head>
<body>
<div class="gg-pv-note">
  <b>预览模式</b>（仅开发用，不进卡）：模拟酒馆助手环境（世界书守护灵条目×2、备选开场白×2，均为<b>预览占位</b>）。
  真实运行于 SillyTavern 时无此提示条。宽度/高度/缩放控制条固定在页面底部。
</div>
<div class="gg-pv-frame"><div class="gg-pv-canvas" id="ggPvCanvas"><div id="ggPvStage" style="width:640px;max-width:100%"><div id="ggPvZoom">
${page}
</div></div></div></div>
<div class="gg-pv-ctl">
  <div class="gg-pv-row">
    <span class="gg-pv-lab">宽度</span>
    <button type="button" class="gg-pv-wbtn" data-pv-w="320">320</button>
    <button type="button" class="gg-pv-wbtn" data-pv-w="480">480</button>
    <button type="button" class="gg-pv-wbtn on" data-pv-w="640">640</button>
    <span class="gg-pv-lab">高度</span>
    <button type="button" class="gg-pv-wbtn" data-pv-h="640">640</button>
    <button type="button" class="gg-pv-wbtn on" data-pv-h="800">800</button>
    <button type="button" class="gg-pv-wbtn" data-pv-h="960">960</button>
    <span class="gg-pv-lab">缩放</span>
    <button type="button" class="gg-pv-wbtn on" data-pv-z="100">100%</button>
    <button type="button" class="gg-pv-wbtn" data-pv-z="125">125%</button>
    <button type="button" class="gg-pv-wbtn" data-pv-z="150">150%</button>
    <span id="ggPvState">640×800 · 缩放 100%（320 = ST 实际宽度）</span>
  </div>
</div>
<script>
// ---- 模拟 TH 注入的全局（真实环境由 predefine.js 提供）----
window.__ggPreviewLog = [];
var __pvBooks = {
  '预览世界书': [
    { name: '[mvu_plot] 守护灵·关羽', comment: '[mvu_plot] 守护灵·关羽', enabled: true, constant: true },
    { name: '[mvu_plot] 守护灵·赵公明', comment: '[mvu_plot] 守护灵·赵公明', enabled: false, constant: true }
  ]
};
var __pvGreetings = [
  '预览开场白·壹（占位）：中元夜，玉佩在掌心发烫。',
  '预览开场白·贰（占位）：人间香火，都认这块玉。'
];
function __pvLog(msg) { window.__ggPreviewLog.push(msg); }
window.getCharWorldbookNames = function () { return { primary: '预览世界书', additional: [] }; };
window.getWorldbook = function (name) { return Promise.resolve(__pvBooks[name] || []); };
window.updateWorldbookWith = function (name, updater) {
  __pvBooks[name] = updater(__pvBooks[name] || []);
  __pvLog('世界书更新 → ' + __pvBooks[name].map(function (e) { return e.name + (e.enabled ? ' 开' : ' 关'); }).join('，'));
  return Promise.resolve();
};
window.SillyTavern = { getContext: function () {
  return {
    characters: [{ name: '关公（预览占位）', data: { alternate_greetings: __pvGreetings } }],
    characterId: 0,
    chat: [{ swipes: ['（首个消息·占位）', __pvGreetings[0], __pvGreetings[1]] }],
    saveChat: function () { __pvLog('saveChat（模拟）'); return Promise.resolve(); },
    reloadCurrentChat: function () { __pvLog('reloadCurrentChat（模拟：首楼已切换）'); }
  };
} };

// ---- 预览控制（仅预览壳，不进卡）----
(function () {
  var stage = document.getElementById('ggPvStage');
  var zoomBox = document.getElementById('ggPvZoom');
  var canvas = document.getElementById('ggPvCanvas');
  var stateEl = document.getElementById('ggPvState');
  var cur = { w: 640, h: 800, z: 100 };

  function toggleOn(sel, key, val) {
    var els = document.querySelectorAll(sel);
    for (var i = 0; i < els.length; i++) {
      els[i].classList.toggle('on', Number(els[i].getAttribute('data-pv-' + key)) === val);
    }
  }
  function refresh() {
    stage.style.width = cur.w + 'px';
    canvas.style.minHeight = cur.h + 'px';
    zoomBox.style.zoom = cur.z + '%';
    stateEl.textContent = cur.w + '×' + cur.h + ' · 缩放 ' + cur.z + '%（320 = ST 实际宽度）';
  }
  function bind(sel, key) {
    var els = document.querySelectorAll(sel);
    for (var i = 0; i < els.length; i++) {
      els[i].addEventListener('click', function () {
        cur[key] = Number(this.getAttribute('data-pv-' + key));
        toggleOn(sel, key, cur[key]);
        refresh();
      });
    }
  }
  bind('[data-pv-w]', 'w');
  bind('[data-pv-h]', 'h');
  bind('[data-pv-z]', 'z');
  refresh();
})();
</script>
</body>
</html>
`;
}

// 状态栏源为裸 head/body 片段（无反引号，可直接嵌入模板字符串）；每次请求实时读取，改源刷新即生效
function statusPage() {
  const statusbarSrc = fs.readFileSync(path.join(root, 'source/ui/statusbar.html'), 'utf8');
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>状态栏预览 · 中元特供·关公</title>
<style>
  html,body{margin:0;padding:0;background:#0e0b08}
  body{font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Microsoft YaHei",sans-serif;padding:14px 10px 96px}
  .gg-pv-note{max-width:720px;margin:0 auto 12px;padding:8px 14px;border:1px dashed #5a4a33;border-radius:8px;background:#151009;color:#a99575;font-size:12px;line-height:1.7}
  .gg-pv-note b{color:#c9a24b}
  .gg-pv-frame{max-width:720px;margin:0 auto;display:flex;justify-content:center}
  .gg-pv-canvas{display:flex;align-items:center;justify-content:center;min-height:640px;padding:28px 16px;background:
      radial-gradient(80% 60% at 25% -5%,rgba(90,110,200,.20),transparent 60%),
      radial-gradient(70% 60% at 85% 25%,rgba(120,80,190,.14),transparent 60%),
      linear-gradient(180deg,#0a0e22,#04060f);border:1px solid #1c2340;border-radius:10px}
  .gg-pv-ctl{position:fixed;left:0;right:0;bottom:0;z-index:10;padding:10px 14px;background:#14100c;border-top:1px solid #2a2016;color:#a99575;font-size:12px;line-height:1.9}
  .gg-pv-ctl .gg-pv-row{max-width:720px;margin:0 auto;display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px}
  .gg-pv-ctl .gg-pv-lab{color:#c9a24b}
  .gg-pv-ctl #ggPvState{color:#8a7a5c}
  .gg-pv-wbtn{display:inline-block;min-width:44px;margin:0;padding:2px 8px;border:1px solid #5a4a33;border-radius:6px;background:transparent;color:#c9a24b;font:inherit;font-size:12px;cursor:pointer}
  .gg-pv-wbtn:hover,.gg-pv-wbtn.on{border-color:#c9a24b;background:#2a2016}
</style>
</head>
<body>
<div class="gg-pv-note">
  <b>状态栏预览</b>（仅开发用，不进卡）：模拟 TH 楼层 iframe 注入的 MVU 环境（Mvu.getMvuData / 变量 API / 事件），
  数据均为<b>预览占位</b>。底部控制条调宽度与缩放；「模拟更新」触发 VARIABLE_UPDATE_ENDED 事件，观察状态栏自动刷新。
</div>
<div class="gg-pv-frame"><div class="gg-pv-canvas" id="ggPvCanvas"><div id="ggPvStage" style="width:420px;max-width:100%"><div id="ggPvZoom">
${statusbarSrc}
</div></div></div></div>
<div class="gg-pv-ctl">
  <div class="gg-pv-row">
    <span class="gg-pv-lab">宽度</span>
    <button type="button" class="gg-pv-wbtn on" data-pv-w="320">320</button>
    <button type="button" class="gg-pv-wbtn" data-pv-w="420">420</button>
    <button type="button" class="gg-pv-wbtn" data-pv-w="520">520</button>
    <span class="gg-pv-lab">缩放</span>
    <button type="button" class="gg-pv-wbtn on" data-pv-z="100">100%</button>
    <button type="button" class="gg-pv-wbtn" data-pv-z="125">125%</button>
    <button type="button" class="gg-pv-wbtn" data-pv-z="150">150%</button>
    <button type="button" class="gg-pv-wbtn" id="ggPvUpdate">模拟更新</button>
    <span id="ggPvState">320×auto · 缩放 100%（320 = ST 实际宽度）</span>
  </div>
</div>
<script>
// ---- 模拟 TH 注入的 MVU 环境（真实环境来自 TH 楼层 iframe 注入 + 全局变量）----
window.__pvStat = {
  环境: { 日期: '七月十五', 时间: '子时', 地点: '四宫家本宅·铁门外', 氛围: '雨停，檐下灯笼一红一白' },
  角色: {
    山田凉: { 名字: '山田凉', 在场: true, 状态: '跪在香案前，额头抵着地板', 心声: '神明大人……让我这个月活下去吧', 名分: '香客', 衣着: '校服整齐' },
    惠惠: { 名字: '惠惠', 在场: true, 状态: '双手合十，眼睛亮晶晶', 心声: '研究经费的事……真的很重要', 名分: '', 衣着: '睡裙，光着脚' },
    达克妮丝: { 名字: '达克妮丝', 在场: false, 状态: '', 心声: '', 名分: '', 衣着: '' },
    阿库娅: { 名字: '阿库娅', 在场: false, 状态: '', 心声: '', 名分: '', 衣着: '' }
  }
};
var __pvEvents = {};
var __pvSeq = 1;
window.Mvu = {
  getMvuData: function () { return { stat_data: window.__pvStat }; },
  events: { VARIABLE_INITIALIZED: 'pv_variable_initialized', VARIABLE_UPDATE_ENDED: 'pv_variable_update_ended' }
};
window.eventOn = function (name, fn) { __pvEvents[name] = fn; return { stop: function () { delete __pvEvents[name]; } }; };
window.waitGlobalInitialized = function () { return Promise.resolve(); };
window.getCurrentMessageId = function () { return 0; };
window.getVariables = function () { return { stat_data: window.__pvStat }; };
window.getAllVariables = function () { return { stat_data: window.__pvStat }; };
window.tavern_events = { MESSAGE_UPDATED: 'pv_message_updated' };

// ---- 预览控制（仅预览壳，不进卡）----
(function () {
  var stage = document.getElementById('ggPvStage');
  var zoomBox = document.getElementById('ggPvZoom');
  var stateEl = document.getElementById('ggPvState');
  var cur = { w: 320, z: 100 };

  function toggleOn(sel, key, val) {
    var els = document.querySelectorAll(sel);
    for (var i = 0; i < els.length; i++) {
      els[i].classList.toggle('on', Number(els[i].getAttribute('data-pv-' + key)) === val);
    }
  }
  function refresh() {
    stage.style.width = cur.w + 'px';
    zoomBox.style.zoom = cur.z + '%';
    stateEl.textContent = cur.w + '×auto · 缩放 ' + cur.z + '%（320 = ST 实际宽度）';
  }
  function bind(sel, key) {
    var els = document.querySelectorAll(sel);
    for (var i = 0; i < els.length; i++) {
      els[i].addEventListener('click', function () {
        cur[key] = Number(this.getAttribute('data-pv-' + key));
        toggleOn(sel, key, cur[key]);
        refresh();
      });
    }
  }
  bind('[data-pv-w]', 'w');
  bind('[data-pv-z]', 'z');

  document.getElementById('ggPvUpdate').addEventListener('click', function () {
    __pvSeq++;
    var liang = window.__pvStat.角色['山田凉'];
    liang.状态 = '拜了第 ' + __pvSeq + ' 个头';
    liang.心声 = '第 ' + __pvSeq + ' 次默念：这个月，活下去';
    var fn = __pvEvents['pv_variable_update_ended'] || __pvEvents['pv_message_updated'];
    if (fn) fn({ stat_data: window.__pvStat });
    stateEl.textContent = '已触发 VARIABLE_UPDATE_ENDED ×' + __pvSeq;
  });
  refresh();
})();
</script>
</body>
</html>
`;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/' || url.pathname === '/preview') {
    try {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(previewShell(extractPage()));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('预览生成失败：' + e.message);
    }
    return;
  }
  if (url.pathname === '/status') {
    try {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(statusPage());
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('状态栏预览生成失败：' + e.message);
    }
    return;
  }
  // 静态文件（供访问 source/ 下资源，做路径穿越防护）
  const rel = path.normalize(decodeURIComponent(url.pathname)).replace(/^[/\\]+/, '');
  if (!rel) { res.writeHead(404); res.end('not found'); return; }
  const file = path.resolve(root, rel);
  if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403); res.end('forbidden'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    const types = {
      '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
      '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain; charset=utf-8'
    };
    res.writeHead(200, { 'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log('预览已启动：');
  console.log('  开局页 http://localhost:' + PORT + '/preview');
  console.log('  状态栏 http://localhost:' + PORT + '/status');
  console.log('停止：Ctrl+C 或关闭本进程');
});
