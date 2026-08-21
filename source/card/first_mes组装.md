# first_mes 组装说明 · 中元特供·关公

> 目标：把开局页 + 叙事拼成角色卡 first_mes，可在 SillyTavern 直接导入测试。

## 组装结果（first_mes 内容）

```
<!--gg-opening-begin-->
```html
<!DOCTYPE html>
<html>…完整 HTML 文档（style + 步骤①/② + script）…</html>
```
<!--gg-opening-end-->

中元节夜，{{user}}手中的祖传玉佩忽然发烫，两道虚影浮出——丹凤眼长髯者按刀而立，黑面执鞭者拱手而笑。玉佩在等{{user}}选一位守护灵。四家香火，都认这块玉。
```

- `source/ui/opening-page.html` 整块自带围栏 + 标记（v0.4 起），组装脚本直接拼接，无需手工加
- 渲染链路：ST 渲染围栏为 `<pre><code>` → TH 渲染器识别为前端代码块 → 转 `TH-message` iframe 执行脚本（详见 `source/ui/开局页使用说明.md` §0）
- 开局页负责：①选守护灵（开关世界书条目）→ ②选开场白（切换首消息）
- 末尾叙事是**给模型看的**：开局页整块（含围栏）被 prompt-only 正则替换后，模型看到的就是这段

## 同时要配置的

| 项 | 内容 | 位置 |
|---|---|---|
| 备选开场白 | source/card/备选开场白.md 正文 | 角色卡编辑器「备选开场白」 |
| 守护灵条目×2 | entries/[mvu_plot] 守护灵·关羽/赵公明.md | 角色卡绑定世界书 |
| 家族条目×4 | entries/[mvu_plot] 家族·王/李/张/陈.md | 同上 |
| 更新规则/输出格式 | components/mvu_update_full.txt / _output_format.txt | 同上（[mvu_update]） |
| 初始变量 | components/InitialVariables.json | 同上（识别标记待核实） |
| prompt-only 正则 | `(?s)<!--gg-opening-begin-->[\s\S]*?<!--gg-opening-end-->` → 一行叙事 | 角色卡正则脚本（message 源，替换目标「提示词」） |

## 世界书条目参数（写卡时在 ST 编辑器里设置）

| 条目 | 激活策略 | 关键词 | 位置/深度 |
|---|---|---|---|
| [mvu_plot] 守护灵·关羽 | **常驻蓝灯**（constant，开局页开关 enabled） | — | 角色定义前，常驻注入 |
| [mvu_plot] 守护灵·赵公明 | **常驻蓝灯**（constant，开局页开关 enabled） | — | 同上 |
| [mvu_plot] 家族·王家 | 可选项（绿灯） | 王家 | 同上 |
| [mvu_plot] 家族·李家 | 可选项（绿灯） | 李家 | 同上 |
| [mvu_plot] 家族·张家 | 可选项（绿灯） | 张家 | 同上 |
| [mvu_plot] 家族·陈家 | 可选项（绿灯） | 陈家 | 同上 |
| [mvu_update] 变量更新规则 | 常驻 | — | 同上 |
| [mvu_update] 变量输出格式 | 常驻 | — | 同上 |
| [mvu_update] 初始变量 | 常驻 | — | 同上（识别标记待核实） |

> 守护灵条目标题（comment）必须包含「关羽」/「赵公明」（开局页按标题开关；组装脚本已自动写入）；绿灯关键词写在正文里出现即可正常激活。

## 测试路径（最短验证）

1. 建角色卡 → first_mes 粘贴上述内容 → 「备选开场白」填 1 条
2. 建世界书（绑定角色卡）→ 按上表建条目，正文从 entries/ 复制
3. 装好酒馆助手（渲染器保持默认开启）→ 导入 → 新聊天
4. 点「关羽」→ 世界书条目翻转 → 点开场白 → 首楼切换 → 自由输入
