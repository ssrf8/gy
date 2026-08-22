// build-card.mjs · 组装「中元特供·关公」角色卡 JSON（development_only）
// 用法：node scripts/build-card.mjs
// 输出：artifacts/中元特供·关公.json
// 铁律：只读 source/ 组装；内容修改一律回 source/，改完重跑本脚本。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const S = (p) => read(p).replace(/\s+$/, '');

// ---- 内容源 ----
const page = S('source/ui/opening-page.html');            // 开局页整块
const narrative = S('source/card/first_mes叙事.txt');      // 给模型看的叙事
const firstMes = page + '\n\n' + narrative + '\n';

const openings = fs.readdirSync(path.join(root, 'source/card/openings'))
  .filter((f) => f.endsWith('.txt')).sort()
  .map((f) => S(path.join('source/card/openings', f)));
if (!openings.length) throw new Error('source/card/openings/ 没有开场白');

const ruleFull = S('source/components/mvu_update_full.txt');
const ruleFormat = S('source/components/mvu_update_output_format.txt');
const initVars = S('source/components/InitialVariables.json');
const scriptLoader = S('source/components/mvu_zod_cn.js');
const scriptSchema = S('source/components/zod_schema.js');

const entriesDir = path.join(root, 'source/worldbook/entries');
const entryFiles = fs.readdirSync(entriesDir).filter((f) => f.endsWith('.md')).sort();
const entryContent = new Map(entryFiles.map((f) => [f.replace(/\.md$/, ''), S(path.join('source/worldbook/entries', f))]));

// ---- 条目参数（ST v2DataWorldInfoEntry，字段名已按 ST 1.18.0 源码核实）----
// 注意：ST 世界书条目的「标题」= comment 字段（v2 无顶层 name）；
//       TH 的 updateWorldbookWith 视角里 entry.name 也映射自 comment（JS-Slash-Runner worldbook.ts）。
//       因此条目名写入 comment；[initvar] 标记也必须在 comment 中（MVU bundle.js 匹配 comment）。
const order = ['[mvu_update] 变量更新规则', '[mvu_update] 变量输出格式', '[mvu_update] 初始变量',
  '[mvu_plot][mvu_update] 当前变量投影',
  '[mvu_plot] 守护灵·关羽', '[mvu_plot] 守护灵·赵公明',
  '[mvu_plot] 角色·山田凉', '[mvu_plot] 角色·慧慧', '[mvu_plot] 角色·达克妮丝', '[mvu_plot] 角色·阿库娅', '[mvu_plot] 角色·委托人',
  '[mvu_plot] 四宫家·辉夜',
  '[mvu_plot] 四宫家·雁庵', '[mvu_plot] 四宫家·名夜竹', '[mvu_plot] 四宫家·黄光', '[mvu_plot] 四宫家·青龙', '[mvu_plot] 四宫家·云鹰', '[mvu_plot] 四宫家·早坂爱'];
const defs = {
  '[mvu_update] 变量更新规则': { constant: true, enabled: true, keys: [], comment: '[mvu_update] 变量更新规则' },
  '[mvu_update] 变量输出格式': { constant: true, enabled: true, keys: [], comment: '[mvu_update] 变量输出格式' },
  '[mvu_update] 初始变量': { constant: false, enabled: false, keys: [], comment: '[mvu_update] 初始变量 [initvar]' },
  '[mvu_plot][mvu_update] 当前变量投影': { constant: true, enabled: true, keys: [], comment: '[mvu_plot][mvu_update] 当前变量投影' },
  // 守护灵条目：常驻蓝灯（constant: true）——无论玩家聊天中是否提到关键词，启用的一条始终注入上下文；
  // 开局页按钮只翻转 enabled（启用一条、关闭另一条），constant 不变。
  '[mvu_plot] 守护灵·关羽': { constant: true, enabled: true, selective: false, keys: [], comment: '[mvu_plot] 守护灵·关羽' },
  '[mvu_plot] 守护灵·赵公明': { constant: true, enabled: false, selective: false, keys: [], comment: '[mvu_plot] 守护灵·赵公明' },
  // 角色条目：绿灯（selective + keys，关键词命中当前消息才注入）——财神线角色名只在本线叙述中出现，跨线零噪音
  '[mvu_plot] 角色·山田凉': { constant: false, enabled: true, selective: true, keys: ['山田凉', '山田'], comment: '[mvu_plot] 角色·山田凉' },
  '[mvu_plot] 角色·慧慧': { constant: false, enabled: true, selective: true, keys: ['慧慧'], comment: '[mvu_plot] 角色·慧慧' },
  '[mvu_plot] 角色·达克妮丝': { constant: false, enabled: true, selective: true, keys: ['达克妮丝', '女骑士'], comment: '[mvu_plot] 角色·达克妮丝' },
  '[mvu_plot] 角色·阿库娅': { constant: false, enabled: true, selective: true, keys: ['阿库娅'], comment: '[mvu_plot] 角色·阿库娅' },
  '[mvu_plot] 角色·委托人': { constant: false, enabled: true, selective: true, keys: ['四宫', '商人', '哭诉'], comment: '[mvu_plot] 角色·委托人' },
  // 四宫家系列（仇敌阵营）：正文占位待补；绿灯=人名
  '[mvu_plot] 四宫家·辉夜': { constant: false, enabled: true, selective: true, keys: ['辉夜'], comment: '[mvu_plot] 四宫家·辉夜' },
  '[mvu_plot] 四宫家·雁庵': { constant: false, enabled: true, selective: true, keys: ['雁庵'], comment: '[mvu_plot] 四宫家·雁庵' },
  '[mvu_plot] 四宫家·名夜竹': { constant: false, enabled: true, selective: true, keys: ['名夜竹'], comment: '[mvu_plot] 四宫家·名夜竹' },
  '[mvu_plot] 四宫家·黄光': { constant: false, enabled: true, selective: true, keys: ['四宫黄光', '黄光'], comment: '[mvu_plot] 四宫家·黄光' },
  // 青龙只能用全名做关键词：裸词「青龙」会撞关羽条目的青龙偃月刀
  '[mvu_plot] 四宫家·青龙': { constant: false, enabled: true, selective: true, keys: ['四宫青龙'], comment: '[mvu_plot] 四宫家·青龙' },
  '[mvu_plot] 四宫家·云鹰': { constant: false, enabled: true, selective: true, keys: ['云鹰'], comment: '[mvu_plot] 四宫家·云鹰' },
  '[mvu_plot] 四宫家·早坂爱': { constant: false, enabled: true, selective: true, keys: ['早坂'], comment: '[mvu_plot] 四宫家·早坂爱' },
};
const contentOf = {
  '[mvu_update] 变量更新规则': ruleFull,
  '[mvu_update] 变量输出格式': ruleFormat,
  '[mvu_update] 初始变量': '<initvar>\n' + initVars + '\n</initvar>',
};

const entries = order.map((name, i) => {
  const def = defs[name];
  return {
    id: i,
    name,
    keys: def.keys || [],
    secondary_keys: [],
    comment: def.comment ?? '',
    content: contentOf[name] ?? entryContent.get(name) ?? '',
    constant: !!def.constant,
    selective: !!def.selective,
    insertion_order: i,
    enabled: def.enabled,
    position: 'before_char',
    extensions: {
      position: 0,
      exclude_recursion: false,
      display_index: i,
      probability: 100,
      useProbability: true,
    },
  };
});
for (const e of entries) {
  if (!e.content) throw new Error('条目缺少内容: ' + e.id + ' ' + order[e.id]);
}

// ---- 正则组（顺序即执行顺序；placement 0=MD_DISPLAY 已废弃禁用，全部用 2=AI_OUTPUT）----
// markdownOnly=只改显示不写回 JSONL；promptOnly=只改提示词；maxDepth 3=仅最新 4 楼。
const statusbar = S('source/ui/statusbar.html');
const regexScripts = [
  {
    id: '1102f8b1-0000-4000-8000-000000000001',
    scriptName: '开局页送模替换（prompt-only）',
    findRegex: '/<!--gg-opening-begin-->[\\s\\S]*?<!--gg-opening-end-->/g',
    replaceString: '（角色出示祖传玉佩，两道守护灵虚影浮出，等待玩家选择其一。）',
    placement: [2],
    disabled: false, trimStrings: [], markdownOnly: false, promptOnly: true,
    runOnEdit: false, substituteRegex: 0, minDepth: 0, maxDepth: null,
  },
  {
    id: '1102f8b1-0000-4000-8000-000000000002',
    scriptName: '剥离变量更新块（提示词）',
    findRegex: '/<UpdateVariable>[\\s\\S]*?<\\/UpdateVariable>/gm',
    replaceString: '',
    placement: [2],
    disabled: false, trimStrings: [], markdownOnly: false, promptOnly: true,
    runOnEdit: true, substituteRegex: 0, minDepth: 0, maxDepth: null,
  },
  {
    id: '1102f8b1-0000-4000-8000-000000000003',
    scriptName: '状态栏占位剥离（提示词）',
    findRegex: '/<GuanGongStatus\\s*\\/>/g',
    replaceString: '',
    placement: [2],
    disabled: false, trimStrings: [], markdownOnly: false, promptOnly: true,
    runOnEdit: true, substituteRegex: 0, minDepth: 0, maxDepth: null,
  },
  {
    id: '1102f8b1-0000-4000-8000-000000000004',
    scriptName: '隐藏变量更新块（显示层）',
    findRegex: '/<UpdateVariable>[\\s\\S]*?<\\/UpdateVariable>/gi',
    replaceString: '',
    placement: [2],
    disabled: false, trimStrings: [], markdownOnly: true, promptOnly: false,
    runOnEdit: false, substituteRegex: 0, minDepth: 0, maxDepth: null,
  },
  {
    id: '1102f8b1-0000-4000-8000-000000000005',
    scriptName: '隐藏流式半截更新块（显示层）',
    findRegex: '/<UpdateVariable>(?![\\s\\S]*<\\/UpdateVariable>)[\\s\\S]*$/i',
    replaceString: '',
    placement: [2],
    disabled: false, trimStrings: [], markdownOnly: true, promptOnly: false,
    runOnEdit: false, substituteRegex: 0, minDepth: 0, maxDepth: null,
  },
  {
    // 渲染必须排在「旧楼占位隐藏」之前：链式执行，本条替换后文本不再含占位符，不会被下一条误删
    id: '1102f8b1-0000-4000-8000-000000000006',
    scriptName: '状态栏渲染（显示层，最新 4 楼）',
    findRegex: '/<GuanGongStatus\\s*\\/>/i',
    replaceString: '```html\n' + statusbar + '\n```',
    placement: [2],
    disabled: false, trimStrings: [], markdownOnly: true, promptOnly: false,
    runOnEdit: false, substituteRegex: 0, minDepth: 0, maxDepth: 3,
  },
  {
    id: '1102f8b1-0000-4000-8000-000000000007',
    scriptName: '状态栏占位隐藏（显示层，旧楼兜底）',
    findRegex: '/<GuanGongStatus\\s*\\/>/g',
    replaceString: '',
    placement: [2],
    disabled: false, trimStrings: [], markdownOnly: true, promptOnly: false,
    runOnEdit: false, substituteRegex: 0, minDepth: 0, maxDepth: null,
  },
];

// ---- 组装 ----
const card = {
  spec: 'chara_card_v2',
  spec_version: '2.0',
  data: {
    name: '关公',
    description: '{{char}}是{{user}}祖传玉佩中的守护灵。开局时{{user}}可从两位守护灵中选择其一——关羽（武圣之力：刀法通神、威压邪祟）或赵公明（财神之力：招财进宝、镇宅安民）；选定后{{char}}以所选守护灵的身份显现、对话与显灵。信徒视{{user}}为神灵显灵，香火即神力之源。中元节夜，百鬼巡街。',
    personality: '取决于所选守护灵：关羽重义刚直、言出必行；赵公明圆融通达、爱财有道。详见世界书守护灵条目。',
    scenario: '中元节夜，{{user}}的祖传玉佩忽然觉醒，两道守护灵虚影浮现，等待{{user}}选择其一。选定后，{{user}}降临虔诚祭拜的信徒现场，自由输入开始。',
    first_mes: firstMes,
    mes_example: '',
    creator_notes: '组装产物（由 scripts/build-card.mjs 从 source/ 生成）。修改请回 source/ 后重新组装。卡名与身份字段为占位，待定稿。',
    system_prompt: '',
    post_history_instructions: '',
    alternate_greetings: openings,
    tags: ['守护灵', '中元节', '二选一', 'MVU', '关公'],
    creator: '',
    character_version: '0.1.0',
    extensions: {
      tavern_helper: {
        scripts: [
          { name: 'mvu_zod_cn.js', content: scriptLoader },
          { name: 'zod_schema.js', content: scriptSchema },
        ],
      },
      regex_scripts: regexScripts,
    },
    character_book: {
      name: '中元特供·关公·世界书',
      entries,
    },
  },
};

const out = path.join(root, 'artifacts/中元特供·关公.json');
fs.writeFileSync(out, JSON.stringify(card, null, 2) + '\n', 'utf8');

// ---- 摘要 ----
console.log('输出: artifacts/中元特供·关公.json');
console.log('first_mes: ' + card.data.first_mes.length + ' 字符 / ' + Buffer.byteLength(card.data.first_mes, 'utf8') + ' bytes');
console.log('备选开场白: ' + openings.length + ' 条');
console.log('世界书条目: ' + entries.length + ' 条（' + entries.filter((e) => e.enabled).length + ' 启用）');
console.log('TH 脚本: ' + card.data.extensions.tavern_helper.scripts.map((s) => s.name).join(', '));
console.log('正则: ' + regexScripts.length + ' 条（prompt-only）');
console.log('JSON 总大小: ' + Buffer.byteLength(JSON.stringify(card), 'utf8') + ' bytes');
