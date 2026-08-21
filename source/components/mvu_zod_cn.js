// mvu_zod_cn.js · 中元特供·关公 MVU 加载器
// 职责：等待环境就绪 → 加载 MagVarUpdate bundle（国内镜像优先，失败回退主镜像）→ 注入默认设置。
// 注意：不创建、不模拟 MVU 初始化事件；开局初始化由世界书初始变量机制负责。

const DEFAULTS = Object.freeze({
  reprocessVariables: true,
  rereadInitialVariables: true,
  retryExtraModelParse: true,
  '重新处理变量': true,
  '重新读取初始变量': true,
  '重试额外模型解析': true,
});

const waitForMvuReady = async () => {
  if (typeof waitGlobalInitialized === 'function') return waitGlobalInitialized('Mvu');
  const started = Date.now();
  while (!window.Mvu && Date.now() - started < 8000) {
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  return window.Mvu;
};

// 世界书就绪等待：当前无卡专属 Ready 信号，用固定沉降时间；写卡阶段如需精确同步再替换
const waitWorldbookReady = async () => {
  await new Promise(resolve => setTimeout(resolve, 250));
};

await waitWorldbookReady();

// 加载 MVU bundle：国内镜像优先，失败回退主镜像
try {
  await import('https://testingcf.jsdelivr.net/gh/MagicalAstrogy/MagVarUpdate/artifact/bundle.js');
} catch (error) {
  await import('https://cdn.jsdelivr.net/gh/MagicalAstrogy/MagVarUpdate/artifact/bundle.js');
}

const Mvu = await waitForMvuReady();

// 注入默认设置（守卫式：具体设置 API 以真机为准，失败不阻塞）
if (Mvu && typeof Mvu.setDefault === 'function') {
  for (const [key, value] of Object.entries(DEFAULTS)) {
    Mvu.setDefault(key, value);
  }
}
