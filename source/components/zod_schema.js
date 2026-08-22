// zod_schema.js · 中元特供·关公
// 职责：定义 stat_data 结构约束，注册到 MVU 变量管理器。
// 设计权威：source/card/玩法设计.md（容器：环境 / user / 玉佩 / 角色）
// 铁律：z 是 TavernHelper 注入的全局变量，禁止从 CDN 另引 zod 实例。

// Step 1: import registerMvuSchema（带双镜像 fallback）
let registerMvuSchema;
try {
  ({ registerMvuSchema } = await import(
    'https://cdn.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js'
  ));
} catch (error) {
  ({ registerMvuSchema } = await import(
    'https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js'
  ));
}

// Step 2: 辅助函数
function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

// 松散字符串：undefined / null / '' → fallback
const LooseString = (fallback = '') => z.preprocess(
  v => (v === undefined || v === null || v === '' ? fallback : String(v)),
  z.string()
).prefault(fallback);

// 松散布尔：'true'/'false' 字符串归一
const LooseBool = (fallback = false) => z.preprocess(
  v => (v === 'true' ? true : v === 'false' ? false : v),
  z.boolean()
).prefault(fallback);

// 守护灵：别名归一 → 枚举（'' / 关羽 / 赵公明）；未识别值归 ''（视为未选）
const 守护灵 = z.preprocess(v => {
  const s = v === undefined || v === null ? '' : String(v).trim();
  if (s.includes('关')) return '关羽';
  if (s.includes('赵') || s.includes('财')) return '赵公明';
  return '';
}, z.enum(['', '关羽', '赵公明'])).prefault('');

// 角色项（动态角色池成员；新增角色由模型按更新规则 add 完整对象）
const 角色项 = z.object({
  名字: LooseString().describe('姓名/称呼'),
  在场: LooseBool(false).describe('是否在当前场景内'),
  状态: LooseString().describe('一句话姿态/处境'),
  心声: LooseString().describe('一句话内心所想'),
  身体情况: LooseString().describe('身体状态，一行'),
});

// Step 3: 顶层 schema（容器与字段见玩法设计.md §5）
const Schema = z.preprocess(
  raw => (isPlainObject(raw) ? raw : {}),
  z.object({
    环境: z.object({
      日期: LooseString(),
      时间: LooseString(),
      地点: LooseString(),
      氛围: LooseString(),
    }).prefault({}),
    user: z.object({
      状态: LooseString(),
      位置: LooseString(),
    }).prefault({}),
    玉佩: z.object({
      当前守护灵: 守护灵.describe('当前守护灵：关羽/赵公明；空=未选'),
    }).prefault({}),
    角色: z.record(z.string(), 角色项).prefault({}),
  })
);

// Step 4: 注册（必须在 $() 回调中）
$(() => { registerMvuSchema(Schema); });
