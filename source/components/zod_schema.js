// zod_schema.js · 中元特供·关公
// 职责：定义 stat_data 结构约束，注册到 MVU 变量管理器。
// 设计权威：source/card/玩法设计.md（当前容器：环境 / user / 玉佩）
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

// Step 3: 顶层 schema（容器与字段见玩法设计.md §4）
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
      当前守护灵: LooseString(),
      显灵状态: LooseString('未觉醒'),
    }).prefault({}),
  })
);

// Step 4: 注册（必须在 $() 回调中）
$(() => { registerMvuSchema(Schema); });
