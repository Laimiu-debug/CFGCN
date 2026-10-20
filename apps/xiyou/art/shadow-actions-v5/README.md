# 西游皮影 v5：紧凑体态、玩家控制与分层招式

2026-10-20。用户否定瘦高体态、反向横移、自动跳跃抢控制、卡顿与简单招式，并要求取消场景透视。本版按八人的腿段 / 躯干 / 身宽分别改原生骨架和网格，脸型等比保留；普通技能不自动移动或跳跃，独立空格 / 触屏键负责 0.45 秒闪避。五人各 12 选四、历史 v4 源件与源 PNG 保留，最终造型与动作仍待审阅。

逐人将肩关节对准胸衣原图上的实际肩孔，整条手臂与兵器同步重设刚性绑定；去掉旧仿射剪切，按独立厚度沿真实关节轴映射袖片。上臂网格 / UV 裁至肘盖之后，避免重复下段袖口。双手握距依各人身高为 14%–18%，同时满足两臂可达范围。源 PNG 未重绘；原图像素、原始 Blender 和 v3 文件均另作哈希核对。

已另接入当前地图的五人演武：<http://127.0.0.1:5173/?mode=skills#/world/xiyou>，真实战斗与接入边界见仓库 `docs/xiyou-shadow-trial.md`。8882 为逐招检视册，短片也是模型检视，不能混作战斗录像。

- 60 项主角动作、18 项妖怪动作；通用受击 / 后撤另计。
- 94 项全身动作、74 项移动上身片段、32 项基础片段，共 200 个实际 GLB 动画片段；六十项主角技能全部有移动上身层。
- 八套可编辑 Blender、内嵌画稿、16 分件、16 骨骼、单材质运行 GLB 与 78 张实际接触姿势缩图。
- `skills.json`：110 项设计条目，含 60 主角、20 被动、18 妖怪和 12 连携；被动与连携不凑技能动作数。
- 本版不沿用 v3 动作影片冒充返工后的影片。当前使用可逐帧检视的真实 GLB、32 张肩臂近图和实际游戏录像；`films.py` / `encode_films.py` 仅保留为可选离线制作脚本，未将未完成帧序列计作交付影片。

## 本机演练

在仓库根目录执行 `node apps/xiyou/art/shadow-actions-v5/serve.mjs`，打开 <http://127.0.0.1:8882/>。选五位主角，从技能册选招后装入指定槽；图标或 1–4 出招，也可“演练四槽”。“试用新增四招”快速检查本轮动作。悟空另有棍法强攻、分身指挥、游斗反击三种示例。

四槽只接受本角色四个不同技能，重复装备交换槽位；装备按钮先暂停整备。每个技能的试用冷却独立记录，换槽 / 换人不刷新。暂停同时冻结动作与冷却，退出资源演练取消剩余事件并保留冷却。方案保存到独立键 `cfgcn:xiyou:shadow-loadouts:v1`，不读写旧剧情 / 地图存档；存储受限时仍可演练并显示未保存反馈。

## 文件与运行接点

每人 `*-actions.blend` 内有分件与打包画稿，可独立打开编辑；`*-actions.glb` 为实际运行资源。`manifest.json` 记录身体分区修改、动作时长、事件、肩肘 / 握杆和来源哈希。上身片段只含九个上身骨骼，`WalkLower` 仅含七个下身骨骼；主角普通技能均为地面版，唯独按键闪避包含主动短腾空。伤害和碰撞由游戏结算。

`director.mjs` 可独立导入，负责装备验证、每人一次身体动作、冷却、暂停、中断和一次性事件。渲染端按 `cast.time` 采样实际动画；战斗端必须进一步判断目标、遮挡、命中、格挡条件和有限收益。事件发出不代表命中，`root_motion` 必须经过真实地图碰撞，不能直接瞬移。

飞棍在武器骨骼中实际离手、转动和接回；离手 / 回旋 / 接回都有精确关键帧。前后双铲、双月剑锋、持续压制分别给出多时点事件。`rehearsal_cooldown` 仅为操作试用值，不是正式数值。

当前地图演武取消友方满地铺片，以身体高度的棍风、直捣、落击、竖起莲瓣 / 水浪与护持表示技能，真实伤害才产生短命中碎笔。敌方普通武器用身体起手与短轨迹表达，重击 / 毒区保留真实半径的细边界，预警只到命中。详见 `apps/xiyou/rust/src/shadow_fx.rs` 和 `docs/xiyou-shadow-trial.md`。

常驻护盾仅以身体两侧细亮边显示，留出胸前与双臂；明亮笔芯只用于短出手、弹道与实际命中。

## 再生成与验证

作者脚本沿用仓库的 `shadow-actions-v1/`、`shadow-actions-v2/` 和 `shadow-roster-v4/` 只读依赖；重新生成需要这些目录和本机 Blender 5.2。原生 Blender 本身已打包图像，无需脚本也能打开检查。

```powershell
& 'F:\SteamLibrary\steamapps\common\Blender\blender.exe' --background --factory-startup --python-exit-code 1 --python apps/xiyou/art/shadow-actions-v5/author.py
python apps/xiyou/art/shadow-actions-v5/prepare_checks.py
& 'F:\SteamLibrary\steamapps\common\Blender\blender.exe' --background --factory-startup --python-exit-code 1 --python apps/xiyou/art/shadow-actions-v5/check.py
& 'F:\SteamLibrary\steamapps\common\Blender\blender.exe' --background --factory-startup --python-exit-code 1 --python apps/xiyou/art/shadow-actions-v5/render.py
python apps/xiyou/art/shadow-actions-v5/skill_book.py
python apps/xiyou/art/shadow-actions-v5/prepare_preview.py
node --test apps/xiyou/art/shadow-actions-v5/director.test.mjs
```

`check.py` 另检查实际胸衣肩孔 / 上臂肩点、上臂肘点 / 前臂肘点和双手握距。`inspect-arms.py` 在固定镜头检查每人备势、蓄力、接触与收势近景。专项及游戏证据位于 `.local/qa/shadow-actions-v5/`，ZIP 与逐文件哈希由 `package.py` 生成并回读。测试与姿态采样不代替用户的美术认可。

本批完成动作资源、四槽检视和五人地图演武初版。正式培养 / 连携、专用法术实体与画稿、完整妖怪 AI、剧情组合、五人怪海成本和手机硬件仍待完善与验收，不能把独立演武当作完成正式一局游戏。
