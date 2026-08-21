// verify-card.mjs · 产物验证（对应 TH 前端代码块机制 + 字段链 + 送模文本检查）
// 用法：node scripts/verify-card.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const card = JSON.parse(fs.readFileSync(path.join(root, 'artifacts/中元特供·关公.json'), 'utf8'));
const d = card.data;
const ok = [];
const fail = [];

// 1. TH 前端代码块机制：围栏 + 完整 HTML 文档 + 标记位置
if (d.first_mes.includes('```html')) ok.push('first_mes 含 html 围栏'); else fail.push('缺围栏');
if (d.first_mes.startsWith('<!--gg-opening-begin-->')) ok.push('begin 标记在围栏外首行'); else fail.push('begin 标记位置错');
if (d.first_mes.includes('<!--gg-opening-end-->')) ok.push('end 标记存在'); else fail.push('缺 end 标记');
if (d.first_mes.includes('<!DOCTYPE html>') && d.first_mes.includes('<body>') && d.first_mes.includes('<head>')) ok.push('围栏内为完整 HTML 文档（isFrontend 命中）'); else fail.push('不是完整文档');
if (d.first_mes.includes('data-opening-protocol="1"')) ok.push('开局页协议根节点存在'); else fail.push('缺协议根节点');

// 2. prompt-only 剥离后模型可见文本
const regex = d.extensions.regex_scripts[0];
const stripped = d.first_mes.replace(new RegExp(regex.findRegex, 'g'), regex.replaceString);
const bad = ['<!DOCTYPE', '<div', '<script', '```', 'gg-opening'];
const leftover = bad.filter(w => stripped.includes(w));
if (!leftover.length) ok.push('剥离后无 UI/围栏残留'); else fail.push('剥离后仍有残留: ' + leftover.join(','));
console.log('剥离后模型可见文本：' + JSON.stringify(stripped.slice(0, 160)) + ' …');

// 3. 条目标题 = comment（ST v2 无顶层 name，TH 视角 entry.name 映射自 comment）
const es = d.character_book.entries;
const titles = es.map(e => e.comment);
if (es.length === 9) ok.push('世界书 9 条'); else fail.push('世界书条目数 = ' + es.length);
for (const t of ['[mvu_update] 变量更新规则', '[mvu_update] 变量输出格式', '[mvu_plot] 守护灵·关羽', '[mvu_plot] 守护灵·赵公明', '[mvu_plot] 家族·王家']) {
  if (titles.includes(t)) ok.push('条目标题在 comment：' + t); else fail.push('缺条目标题：' + t);
}
if (titles.some(t => t.startsWith('[mvu_update] 初始变量'))) ok.push('初始变量条目标题含 [initvar] 标记'); else fail.push('缺初始变量条目标题');

// 4. 守护灵默认开关状态（开局页 entryHitText 按 comment/name 匹配）
const find = (g) => es.filter(e => ((e.comment || '') + ' ' + (e.name || '')).includes(g));
if (find('关羽').length === 1 && find('关羽')[0].enabled) ok.push('关羽条目默认启用'); else fail.push('关羽条目默认状态错');
if (find('赵公明').length === 1 && !find('赵公明')[0].enabled) ok.push('赵公明条目默认关闭'); else fail.push('赵公明条目默认状态错');
if (find('关羽')[0] && find('关羽')[0].constant && !find('关羽')[0].selective) ok.push('守护灵条目为常驻蓝灯（constant，非关键词触发）'); else fail.push('守护灵条目非常驻（constant 缺失）');
const initVar = es.find(e => e.comment.includes('[initvar]'));
if (initVar && initVar.content.includes('<initvar>')) ok.push('初始变量条目含 <initvar>'); else fail.push('初始变量条目异常');

// 5. 标记区域外无开发注释
const outside = d.first_mes.split('<!--gg-opening-end-->')[1] || '';
const devWords = ['v0.4', 'TH-message', '渲染器', 'isFrontend', 'build'];
const leaked = devWords.filter(w => outside.includes(w));
if (!leaked.length) ok.push('标记外无开发注释'); else fail.push('标记外残留开发字样: ' + leaked.join(','));

// 6. 其他字段链
if (d.alternate_greetings.length === 1) ok.push('备选开场白 1 条'); else fail.push('开场白数量 = ' + d.alternate_greetings.length);
const thNames = d.extensions.tavern_helper.scripts.map(s => s.name).join(',');
if (thNames === 'mvu_zod_cn.js,zod_schema.js') ok.push('TH 脚本 2 个'); else fail.push('TH 脚本异常: ' + thNames);
if (card.spec === 'chara_card_v2' && card.spec_version === '2.0') ok.push('spec v2 / 2.0'); else fail.push('spec 异常');

console.log('\n== 验证结果 ==');
for (const x of ok) console.log('PASS  ' + x);
for (const x of fail) console.log('FAIL  ' + x);
console.log('总计: ' + ok.length + ' 过 / ' + fail.length + ' 挂');
process.exit(fail.length ? 1 : 0);
