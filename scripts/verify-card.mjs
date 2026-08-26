// verify-card.mjs · 产物验证（对应 TH 前端代码块机制 + 字段链 + 送模文本检查）
// 用法：node scripts/verify-card.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cardFlag = process.argv.indexOf('--card');
const cardPath = cardFlag >= 0
  ? path.resolve(root, process.argv[cardFlag + 1] || '')
  : path.join(root, 'artifacts/中元特供·关公.json');
if (cardFlag >= 0 && !process.argv[cardFlag + 1]) throw new Error('--card 需要角色卡 JSON 路径');
const card = JSON.parse(fs.readFileSync(cardPath, 'utf8'));
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
if (renderRx && renderRx.replaceString.includes('mvu.events.VARIABLE_UPDATE_ENDED') && renderRx.replaceString.includes('mvu.events.VARIABLE_INITIALIZED') && renderRx.replaceString.includes("waitGlobalInitialized('Mvu')")) ok.push('状态栏监听 MVU 初始化/更新完成事件'); else fail.push('状态栏缺 MVU 刷新生命周期');
if (renderRx && hideRx && rx.indexOf(renderRx) < rx.indexOf(hideRx)) ok.push('渲染正则排在旧楼隐藏之前'); else fail.push('状态栏正则顺序错');
if (stripPhRx && stripPhRx.promptOnly && compile(stripPhRx.findRegex).test('正文\n<GuanGongStatus/>')) ok.push('占位符提示词剥离可用'); else fail.push('占位符提示词剥离异常');
const uvHide = byName('隐藏变量更新块（显示层）') , uvStream = byName('隐藏流式半截更新块（显示层）'), uvStrip = byName('剥离变量更新块（提示词）');
if (uvHide && uvStream && uvStrip && compile(uvHide.findRegex).test('<UpdateVariable>x</UpdateVariable>') && compile(uvStream.findRegex).test('<UpdateVariable>半截')) ok.push('UpdateVariable 三连正则（提示词剥离/显示隐藏/流式半截）'); else fail.push('UpdateVariable 正则组异常');

// 3. 条目标题 = comment（ST v2 无顶层 name，TH 视角 entry.name 映射自 comment）
const es = d.character_book.entries;
const titles = es.map(e => e.comment);
if (es.length === 26) ok.push('世界书 26 条'); else fail.push('世界书条目数 = ' + es.length);
for (const t of ['[mvu_update] 变量更新规则', '[mvu_update] 变量输出格式', '[mvu_plot][mvu_update] 当前变量投影', '[mvu_plot] 状态栏输出', '[mvu_plot] 守护灵·关羽', '[mvu_plot] 守护灵·赵公明', '[mvu_plot] 审判手段', '[mvu_plot] 角色·山田凉', '[mvu_plot] 角色·慧慧', '[mvu_plot] 角色·达克妮丝', '[mvu_plot] 角色·阿库娅', '[mvu_plot] 角色·佐藤和真', '[mvu_plot] 角色·委托人', '[mvu_plot] 角色·藤原千花', '[mvu_plot] 角色·藤原萌叶', '[mvu_plot] 四宫家·辉夜', '[mvu_plot] 四宫家·雁庵', '[mvu_plot] 四宫家·名夜竹', '[mvu_plot] 四宫家·黄光', '[mvu_plot] 四宫家·青龙', '[mvu_plot] 四宫家·云鹰', '[mvu_plot] 四宫家·早坂爱', '[mvu_plot] 四宫家·早坂奈央', '[mvu_plot] 藤原家·藤原大地', '[mvu_plot] 藤原家·藤原万穗']) {
  if (titles.includes(t)) ok.push('条目标题在 comment：' + t); else fail.push('缺条目标题：' + t);
}
if (titles.some(t => t.startsWith('[mvu_update] 初始变量'))) ok.push('初始变量条目标题含 [initvar] 标记'); else fail.push('缺初始变量条目标题');

// 4. 守护灵默认开关状态（开局页 entryHitText 按 comment/name 匹配）
const find = (g) => es.filter(e => ((e.comment || '') + ' ' + (e.name || '')).includes(g));
if (find('关羽').length === 1 && find('关羽')[0].enabled) ok.push('关羽条目默认启用'); else fail.push('关羽条目默认状态错');
if (find('赵公明').length === 1 && !find('赵公明')[0].enabled) ok.push('赵公明条目默认关闭'); else fail.push('赵公明条目默认状态错');
if (find('关羽')[0] && find('关羽')[0].constant && !find('关羽')[0].selective) ok.push('守护灵条目为常驻蓝灯（constant，非关键词触发）'); else fail.push('守护灵条目非常驻（constant 缺失）');
const roleEntries = es.filter(e => e.selective);
const roleOk = roleEntries.length === 19 && roleEntries.every(e => !e.constant && e.selective && (e.keys || []).length > 0 && e.enabled);
if (roleOk) ok.push('绿灯条目 ×19（角色/四宫家/藤原家 ×18 + 审判手段）全部 selective + 关键词'); else fail.push('绿灯条目参数异常: ' + roleEntries.length + ' 条');
if (!es.find(e => e.comment === '[mvu_plot] 四宫家·青龙')?.keys?.includes('青龙')) ok.push('青龙关键词用全名（不撞青龙偃月刀）'); else fail.push('青龙裸词关键词会误触发');
const initVar = es.find(e => e.comment.includes('[initvar]'));
if (initVar && initVar.content.includes('<initvar>')) ok.push('初始变量条目含 <initvar>'); else fail.push('初始变量条目异常');
const proj = es.find(e => e.comment.includes('当前变量投影'));
if (proj && proj.content.includes('{{get_message_variable::stat_data}}')) ok.push('投影条目含 stat_data 宏'); else fail.push('投影条目缺宏');
const hudEntry = es.find(e => e.comment === '[mvu_plot] 状态栏输出');
if (proj && !proj.content.includes('<GuanGongStatus/>') && hudEntry && hudEntry.content.includes('<GuanGongStatus/>')) ok.push('共享投影与剧情侧状态栏指令已隔离'); else fail.push('双模型投影仍混入状态栏指令');

// 4.5 初始变量结构（两容器 + 角色预置；玉佩/user/身体情况已裁撤）
let initJson = null;
try { initJson = JSON.parse(initVar.content.replace(/<\/?initvar>/g, '').trim()); } catch (e) {}
if (initJson && ['环境', '角色'].every(k => k in initJson) && !('user' in initJson) && !('玉佩' in initJson)) ok.push('初始变量两容器对齐（玉佩/user 已裁撤）'); else fail.push('初始变量容器不齐或裁撤字段残留');
const roles = (initJson && initJson.角色) || {};
const roleIds = Object.keys(roles);
const roleFields = ['名字', '在场', '状态', '心声'];
if (roleIds.length === 5 && roleIds.every(id => roleFields.every(f => f in roles[id]) && !('身体情况' in roles[id]))) ok.push('角色池预置 5 人 × 4 字段（身体情况已裁撤）'); else fail.push('角色池结构异常: ' + roleIds.join(','));
const schemaSource = fs.readFileSync(path.join(root, 'source/components/zod_schema.js'), 'utf8');
const fieldsOf = (pattern) => {
  const body = pattern.exec(schemaSource)?.[1] || '';
  return [...body.matchAll(/^\s*([\p{Script=Han}\w]+):/gmu)].map(m => m[1]);
};
const schemaEnvFields = fieldsOf(/环境:\s*z\.object\(\{([\s\S]*?)\n\s*\}\)\.prefault/);
const schemaRoleFields = fieldsOf(/const 角色项\s*=\s*z\.object\(\{([\s\S]*?)\n\}\);/);
const sameSet = (a, b) => a.length === b.length && a.every(x => b.includes(x));
if (initJson && sameSet(schemaEnvFields, Object.keys(initJson.环境 || {})) && sameSet(schemaRoleFields, roleFields)) ok.push('schema ↔ InitialVariables 字段集对齐'); else fail.push('schema ↔ InitialVariables 字段集不一致');
const updateRule = es.find(e => e.comment === '[mvu_update] 变量更新规则')?.content || '';
if (updateRule.includes('同一角色的别名不得新建第二条记录') && updateRule.includes('离场只 replace 在场为 false') && !updateRule.includes('久未登场可 remove')) ok.push('动态角色稳定键/离场保留规则已固化'); else fail.push('动态角色生命周期规则不完整');

const clone = value => JSON.parse(JSON.stringify(value));
const atParent = (rootValue, pointer) => {
  const parts = pointer.split('/').slice(1).map(s => s.replace(/~1/g, '/').replace(/~0/g, '~'));
  const key = parts.pop();
  let parent = rootValue;
  for (const part of parts) {
    if (!(part in parent)) throw new Error('父路径不存在: ' + pointer);
    parent = parent[part];
  }
  return { parent, key };
};
const applyPatch = (rootValue, patch) => {
  for (const op of patch) {
    if (op.op === 'move') {
      const from = atParent(rootValue, op.from);
      if (!(from.key in from.parent)) throw new Error('move 源路径不存在');
      const value = from.parent[from.key];
      delete from.parent[from.key];
      const to = atParent(rootValue, op.path);
      to.parent[to.key] = value;
      continue;
    }
    const target = atParent(rootValue, op.path);
    if (op.op === 'replace' && !(target.key in target.parent)) throw new Error('replace 路径不存在');
    if (op.op === 'remove') { if (!(target.key in target.parent)) throw new Error('remove 路径不存在'); delete target.parent[target.key]; continue; }
    if (op.op === 'add' || op.op === 'replace') { target.parent[target.key] = clone(op.value); continue; }
    throw new Error('非法 op: ' + op.op);
  }
  return rootValue;
};
const fixture = applyPatch(clone(initJson), [
  { op: 'replace', path: '/环境/时间', value: '23:15' },
  { op: 'add', path: '/角色/佐藤和真', value: { 名字: '佐藤和真', 在场: true, 状态: '参拜中', 心声: '想回家' } },
  { op: 'replace', path: '/角色/佐藤和真/在场', value: false },
  { op: 'add', path: '/角色/临时路人', value: { 名字: '临时路人', 在场: true, 状态: '', 心声: '' } },
  { op: 'move', from: '/角色/临时路人', path: '/角色/一次性路人' },
  { op: 'remove', path: '/角色/一次性路人' },
]);
let missingReplaceRejected = false;
try { applyPatch(clone(initJson), [{ op: 'replace', path: '/角色/不存在/在场', value: true }]); } catch { missingReplaceRejected = true; }
if (fixture.环境.时间 === '23:15' && fixture.角色.佐藤和真.在场 === false && !fixture.角色.一次性路人 && missingReplaceRejected) ok.push('JSONPatch 四操作/缺路径拒绝夹具通过'); else fail.push('JSONPatch 字段链夹具失败');

// 5. 标记区域外无开发注释
const outside = d.first_mes.split('<!--gg-opening-end-->')[1] || '';
const devWords = ['v0.4', 'TH-message', '渲染器', 'isFrontend', 'build'];
const leaked = devWords.filter(w => outside.includes(w));
if (!leaked.length) ok.push('标记外无开发注释'); else fail.push('标记外残留开发字样: ' + leaked.join(','));

// 6. 其他字段链
if (d.alternate_greetings.length === 4) ok.push('备选开场白 4 条（关羽×2 / 财神×2）'); else fail.push('开场白数量 = ' + d.alternate_greetings.length);
if (d.alternate_greetings.every(g => /^【[^】]+】/.test(String(g).trim()))) ok.push('开场白首行含归属标记（【灵别】标题）'); else fail.push('开场白缺归属标记行');
const thNames = d.extensions.tavern_helper.scripts.map(s => s.name).join(',');
if (thNames === 'mvu_zod_cn.js,zod_schema.js') ok.push('TH 脚本 2 个'); else fail.push('TH 脚本异常: ' + thNames);
const loader = d.extensions.tavern_helper.scripts.find(s => s.name === 'mvu_zod_cn.js')?.content || '';
const schemaScript = d.extensions.tavern_helper.scripts.find(s => s.name === 'zod_schema.js')?.content || '';
if (!loader.includes('setDefault') && !loader.includes('DEFAULTS')) ok.push('加载器无失效的 Mvu.setDefault 契约'); else fail.push('加载器仍含无效默认设置注入');
if (loader.includes('MagVarUpdate@0a730cd4a9b99689d1135a49b542c780b977c24c') && schemaScript.includes('tavern_resource@61e30e9cc69e89bcc9725c57df941175249c566a')) ok.push('远程 MVU/Zod 依赖已锁定提交'); else fail.push('远程运行时未锁定预期提交');
if (card.spec === 'chara_card_v2' && card.spec_version === '2.0') ok.push('spec v2 / 2.0'); else fail.push('spec 异常');

console.log('\n== 验证结果 ==');
for (const x of ok) console.log('PASS  ' + x);
for (const x of fail) console.log('FAIL  ' + x);
console.log('总计: ' + ok.length + ' 过 / ' + fail.length + ' 挂');
process.exit(fail.length ? 1 : 0);
