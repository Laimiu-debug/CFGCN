# 五人主动绝技插画

2026-10-20，内置 image_gen 生成五张透明画稿：金箍镇岳、大乘梵音、天蓬九重耙、流沙覆海、白龙破浪。生成目标是清晰的大轮廓、矿物淡设色、青黛墨线与旧金 / 朱砂，作为水墨皮影游戏技能插画；不是新人物模型或 Tripo 生成。

`*-original.png` 为生成原图，`prompts.json` 保留五份完整实际提示词；`manifest.json` 记录原图尺寸 / 透明度 / SHA-256 与运行图字节和哈希。原图未覆盖。

在仓库根目录执行 `node scripts/prepare-shadow-ui.mjs`，仅缩放和标准编码到 `apps/website/public/games/xiyou/ui/v6/`，五图共 278,094 字节。白龙另编码一份透明 PNG 用于 Bevy 的真实法术弹道；不借助 WebP 以外引擎能力假定解码支持。

实际接入在 `apps/xiyou/src/InkUi.tsx` 和 `ShadowTrial.tsx`，包括四式、冷却、整备目录和暂停预览。动作与机制见 `docs/xiyou-active-skills-ui.md`。画稿及整体界面仍待用户审阅，不因生成成功或工程检查通过标记为最终美术定稿。
