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

// 2. 正则组（规范 findRegex 格式 /pattern/flags；placement 0 已废弃禁用）
const compile = (p) => { const m = /^\/(.+)\/([a-z]*)$/s.exec(p); return new RegExp(m ? m[1] : p, [...new Set(((m ? m[2] : '') + 'g'))].join('')); };
const rx = d.extensions.regex_scripts;
const byName = (n) => rx.find(r => r.scriptName === n);
const openingRx = byName('开局页送模替换（prompt-only）');
if (rx.length === 7) ok.push('正则组 7 条'); else fail.push('正则数 = ' + rx.length);
if (rx.every(r => r.placement.includes(2) && !r.placement.includes(0))) ok.push('placement 全部 [2]（无废弃值 0）'); else fail.push('placement 含废弃/异常值');
for (const r of rx) { try { compile(r.findRegex); } catch (e) { fail.push('正则编译失败: ' + r.scriptName); } }
if (!fail.some(f => f.startsWith('正则编译失败'))) ok.push('7 条 findRegex 全部可编译');
if (openingRx && openingRx.promptOnly && !openingRx.markdownOnly && openingRx.maxDepth === null) ok.push('开局页正则 prompt-only 且不限深度'); else fail.push('开局页正则参数异常');
const stripped = d.first_mes.replace(compile(openingRx.findRegex), openingRx.replaceString);
const bad = ['<!DOCTYPE', '<div', '<script', '```', 'gg-opening'];
const leftover = bad.filter(w => stripped.includes(w));
if (!leftover.length) ok.push('剥离后无 UI/围栏残留'); else fail.push('剥离后仍有残留: ' + leftover.join(','));
console.log('剥离后模型可见文本：' + JSON.stringify(stripped.slice(0, 160)) + ' …');

// 2.5 状态栏与变量块管线
const renderRx = byName('状态栏渲染（显示层，最新 4 楼）');
const hideRx = byName('状态栏占位隐藏（显示层，旧楼兜底）');
const stripPhRx = byName('状态栏占位剥离（提示词）');
if (renderRx && renderRx.markdownOnly && !renderRx.promptOnly && renderRx.maxDepth === 3 && renderRx.replaceString.startsWith('```html') && renderRx.replaceString.includes('data-gg-statusbar')) ok.push('状态栏渲染正则（显示层 / 最新4楼 / 含渲染器）'); else fail.push('状态栏渲染正则异常');
if (renderRx && hideRx && rx.indexOf(renderRx) < rx.indexOf(hideRx)) ok.push('渲染正则排在旧楼隐藏之前'); else fail.push('状态栏正则顺序错');
if (stripPhRx && stripPhRx.promptOnly && compile(stripPhRx.findRegex).test('正文\n<GuanGongStatus/>')) ok.push('占位符提示词剥离可用'); else fail.push('占位符提示词剥离异常');
const uvHide = byName('隐藏变量更新块（显示层）') , uvStream = byName('隐藏流式半截更新块（显示层）'), uvStrip = byName('剥离变量更新块（提示词）');
if (uvHide && uvStream && uvStrip && compile(uvHide.findRegex).test('<UpdateVariable>x</UpdateVariable>') && compile(uvStream.findRegex).test('<UpdateVariable>半截')) ok.push('UpdateVariable 三连正则（提示词剥离/显示隐藏/流式半截）'); else fail.push('UpdateVariable 正则组异常');

// 3. 条目标题 = comment（ST v2 无顶层 name，TH 视角 entry.name 映射自 comment）
const es = d.character_book.entries;
const titles = es.map(e => e.comment);
if (es.length === 18) ok.push('世界书 18 条'); else fail.push('世界书条目数 = ' + es.length);
for (const t of ['[mvu_update] 变量更新规则', '[mvu_update] 变量输出格式', '[mvu_plot][mvu_update] 当前变量投影', '[mvu_plot] 守护灵·关羽', '[mvu_plot] 守护灵·赵公明', '[mvu_plot] 角色·山田凉', '[mvu_plot] 角色·慧慧', '[mvu_plot] 角色·达克妮丝', '[mvu_plot] 角色·阿库娅', '[mvu_plot] 角色·委托人', '[mvu_plot] 四宫家·辉夜', '[mvu_plot] 四宫家·雁庵', '[mvu_plot] 四宫家·名夜竹', '[mvu_plot] 四宫家·黄光', '[mvu_plot] 四宫家·青龙', '[mvu_plot] 四宫家·云鹰', '[mvu_plot] 四宫家·早坂爱']) {
  if (titles.includes(t)) ok.push('条目标题在 comment：' + t); else fail.push('缺条目标题：' + t);
}
if (titles.some(t => t.startsWith('[mvu_update] 初始变量'))) ok.push('初始变量条目标题含 [initvar] 标记'); else fail.push('缺初始变量条目标题');

// 4. 守护灵默认开关状态（开局页 entryHitText 按 comment/name 匹配）
const find = (g) => es.filter(e => ((e.comment || '') + ' ' + (e.name || '')).includes(g));
if (find('关羽').length === 1 && find('关羽')[0].enabled) ok.push('关羽条目默认启用'); else fail.push('关羽条目默认状态错');
if (find('赵公明').length === 1 && !find('赵公明')[0].enabled) ok.push('赵公明条目默认关闭'); else fail.push('赵公明条目默认状态错');
if (find('关羽')[0] && find('关羽')[0].constant && !find('关羽')[0].selective) ok.push('守护灵条目为常驻蓝灯（constant，非关键词触发）'); else fail.push('守护灵条目非常驻（constant 缺失）');
const roleEntries = es.filter(e => /^\[mvu_plot\] (角色|四宫家)·/.test(e.comment || ''));
const roleOk = roleEntries.length === 12 && roleEntries.every(e => !e.constant && e.selective && (e.keys || []).length > 0 && e.enabled);
if (roleOk) ok.push('角色/四宫家条目 ×12 全部绿灯（selective + 关键词）'); else fail.push('角色条目绿灯参数异常: ' + roleEntries.length + ' 条');
if (!es.find(e => e.comment === '[mvu_plot] 四宫家·青龙')?.keys?.includes('青龙')) ok.push('青龙关键词用全名（不撞青龙偃月刀）'); else fail.push('青龙裸词关键词会误触发');
const initVar = es.find(e => e.comment.includes('[initvar]'));
if (initVar && initVar.content.includes('<initvar>')) ok.push('初始变量条目含 <initvar>'); else fail.push('初始变量条目异常');
const proj = es.find(e => e.comment.includes('当前变量投影'));
if (proj && proj.content.includes('{{get_message_variable::stat_data}}')) ok.push('投影条目含 stat_data 宏'); else fail.push('投影条目缺宏');
if (proj && proj.content.includes('<GuanGongStatus/>')) ok.push('投影条目含占位符输出指令'); else fail.push('投影条目缺占位符指令');

// 4.5 初始变量结构（四容器 + 角色预置）
let initJson = null;
try { initJson = JSON.parse(initVar.content.replace(/<\/?initvar>/g, '').trim()); } catch (e) {}
if (initJson && ['环境', 'user', '玉佩', '角色'].every(k => k in initJson)) ok.push('初始变量四容器对齐'); else fail.push('初始变量容器不齐');
if (initJson && initJson.玉佩 && '当前守护灵' in initJson.玉佩 && !('显灵状态' in initJson.玉佩)) ok.push('玉佩仅守护灵字段'); else fail.push('玉佩字段异常');
const roles = (initJson && initJson.角色) || {};
const roleIds = Object.keys(roles);
const roleFields = ['名字', '在场', '状态', '心声', '身体情况'];
if (roleIds.length === 5 && roleIds.every(id => roleFields.every(f => f in roles[id]))) ok.push('角色池预置 5 人 × 5 字段'); else fail.push('角色池结构异常: ' + roleIds.join(','));

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
