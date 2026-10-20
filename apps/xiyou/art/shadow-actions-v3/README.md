# 西游皮影 v3：十二招与四槽

2026-10-20。五位主角各 12 个可装备技能动作，每人选四个；原画、独立体型、v2 加宽手臂和稳定深度层级保留。用户最终美术 / 动作审阅仍待完成。

已另接入当前地图的五人演武：<http://127.0.0.1:5173/?mode=skills#/world/xiyou>，真实战斗与接入边界见仓库 `docs/xiyou-shadow-trial.md`。8880 为逐招检视册，短片也是模型检视，不能混作战斗录像。

- 60 项主角动作、18 项妖怪动作；通用受击 / 后撤另计。
- 94 项全身动作、60 项移动上身片段、32 项基础片段，共 186 个实际 GLB 动画片段。
- 八套可编辑 Blender、内嵌画稿、16 分件、16 骨骼、单材质运行 GLB 与 78 张实际接触姿势缩图。
- `skills.json`：110 项设计条目，含 60 主角、20 被动、18 妖怪和 12 连携；被动与连携不凑技能动作数。
- 五段 `new-actions.webm` 为新增 20 招的实际 GLB 检视短片，不是战斗录像。

## 本机演练

在仓库根目录执行 `node apps/xiyou/art/shadow-actions-v3/serve.mjs`，打开 <http://127.0.0.1:8880/>。选五位主角，从技能册选招后装入指定槽；图标或 1–4 出招，也可“演练四槽”。“试用新增四招”快速检查本轮动作。悟空另有棍法强攻、分身指挥、游斗反击三种示例。

四槽只接受本角色四个不同技能，重复装备交换槽位；装备按钮先暂停整备。每个技能的试用冷却独立记录，换槽 / 换人不刷新。暂停同时冻结动作与冷却，退出资源演练取消剩余事件并保留冷却。方案保存到独立键 `cfgcn:xiyou:shadow-loadouts:v1`，不读写旧剧情 / 地图存档；存储受限时仍可演练并显示未保存反馈。

## 文件与运行接点

每人 `*-actions.blend` 内有分件与打包画稿，可独立打开编辑；`*-actions.glb` 为实际运行资源。`manifest.json` 记录动作时长、起手 / 释放 / 收势、事件接点、独立 root motion、腾空区间、手臂宽度、原件和输出哈希。上身动作只含九个上身骨骼，`WalkLower` 仅含七个下身骨骼；停步 / 跃起动作没有移动上身变体。

`director.mjs` 可独立导入，负责装备验证、每人一次身体动作、冷却、暂停、中断和一次性事件。渲染端按 `cast.time` 采样实际动画；战斗端必须进一步判断目标、遮挡、命中、格挡条件和有限收益。事件发出不代表命中，`root_motion` 必须经过真实地图碰撞，不能直接瞬移。

飞棍在武器骨骼中实际离手、转动和接回；离手 / 回旋 / 接回都有精确关键帧。前后双铲、双月剑锋、持续压制分别给出多时点事件。`rehearsal_cooldown` 仅为操作试用值，不是正式数值。

## 再生成与验证

作者脚本沿用仓库的 `shadow-actions-v1/`、`shadow-actions-v2/` 和 `shadow-roster-v4/` 只读依赖；重新生成需要这些目录和本机 Blender 5.2。原生 Blender 本身已打包图像，无需脚本也能打开检查。

```powershell
& 'F:\SteamLibrary\steamapps\common\Blender\blender.exe' --background --factory-startup --python-exit-code 1 --python apps/xiyou/art/shadow-actions-v3/author.py
python apps/xiyou/art/shadow-actions-v3/prepare_checks.py
& 'F:\SteamLibrary\steamapps\common\Blender\blender.exe' --background --factory-startup --python-exit-code 1 --python apps/xiyou/art/shadow-actions-v3/check.py
& 'F:\SteamLibrary\steamapps\common\Blender\blender.exe' --background --factory-startup --python-exit-code 1 --python apps/xiyou/art/shadow-actions-v3/render.py
python apps/xiyou/art/shadow-actions-v3/skill_book.py
python apps/xiyou/art/shadow-actions-v3/prepare_preview.py
node --test apps/xiyou/art/shadow-actions-v3/director.test.mjs
```

八套 native 重开 / GLB 重导入与 13,594 次实际表面 / 异步步态采样通过；六项调度测试覆盖全部 60 招和装备 / 中断 / 暂停。实际浏览器与短片检查证据在 `.local/qa/shadow-actions-v3/`，ZIP 和逐文件哈希由 `package.py` 生成并回读。

本批完成动作资源、四槽检视和五人地图演武初版。正式培养 / 连携、专用法术实体与画稿、完整妖怪 AI、剧情组合、五人怪海成本和手机硬件仍待完善与验收，不能把独立演武当作完成正式一局游戏。
