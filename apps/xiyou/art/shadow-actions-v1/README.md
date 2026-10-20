# 西游皮影动作模块 v1

八人各三招、受击、后撤：40 段完整身体动作，另有 24 段上身叠加及下身步态，总计 96 段导出片段。当前为动作资源候选，尚未接入正式战斗，不代表新技能、数值或最终造型已确认。

制作、动作表、事件 / 遮罩 / 位移接口、来源、运行和验证边界见 [项目记录](../../../../docs/xiyou-shadow-actions.md)。

- `manifest.json` / `catalog.py`：实际资源目录与编排源。
- 各角色 `*-actions.blend`：16 分件与完整可编辑动作，图像内嵌。
- 各角色 `*-actions.glb`：实际 12 段片段，单材质裁切皮影。
- `action-poses.png` / `all-actions.png`：实际导出模型的阶段图。
- `wukong/exported-glb-actions.mp4`：导出 GLB 的连续动作检视，非游戏录像。
- `author.py` / `check.py` / `render.py` / `encode.py`：编排、重导入轨迹检查和原生检视。
- `preview.html` / `serve.mjs`：`node apps/xiyou/art/shadow-actions-v1/serve.mjs` 后打开 <http://127.0.0.1:8878/>。

原始输入仍在相邻 `shadow-roster-v4/`，不覆盖旧源。离线动作包可独立打开内嵌 Blender / GLB；运行重建脚本需完整项目中的 v4 输入和 Three.js 依赖。手片仍使用现稿，精细指形与独立技能特效继续待制作。双手握点使用画稿 distal 手心，不能用叶骨显示尾点代替。
