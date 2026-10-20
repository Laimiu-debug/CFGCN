# 西游原创皮影资源：八种独立体态候选

后续用户否定：本版所有角色的腿、兵器比例和走动姿势仍有问题。v3 撤回为当前合格候选，保留作历史对照；腿部画稿、真实踝位、屈膝方向、承重动作与兵器返工见 [v4](../shadow-roster-v4/README.md)。下文数值和检查只说明当时的文件 / 部分功能状态，不代表用户已认可造型或步态。

2026-10-20（Asia/Hong_Kong）。用户先指出 v1 缺少腰腹，随后指出 v2 身体比例相同。本版保留补全后的胸腹胯，在可编辑 Blender 分件 / 骨架上重做八种体态，提供同地线、同相机比例的整装和身体剪影。当前是待审候选，文件和浏览器检查不代表用户认可造型。

## 体态设计

| 角色       | 身体与重心                   | 步态候选           |
| ---------- | ---------------------------- | ------------------ |
| 唐僧       | 窄肩修长、连续长袍、端正站姿 | 步幅克制，缓而稳   |
| 悟空       | 较矮、短躯长臂、屈膝蓄势     | 短周期，抬脚更快   |
| 八戒       | 腹部最宽、粗臂短腿、低重心   | 小步、低抬脚、较慢 |
| 沙僧       | 身高最高、宽肩、长躯长臂     | 长步沉稳           |
| 小白龙人形 | 清瘦、肩胯窄、腿较长         | 轻快长步           |
| 狼妖       | 前倾佝偻、窄腰长臂           | 屈膝低身探步       |
| 虎妖       | 倒三角肩背、粗臂大掌         | 有力、略压低重心   |
| 白骨夫人   | 细腰细臂、纤长手足           | 缓步、少摆臂       |

这些是本轮候选的设计参数，非原著人物身高考据，也未替用户确认夸张程度。角色身高、头身比、胸腹体积、四肢长度 / 粗细均独立设计，不能只作整体缩放。共用 16 分件 / 16 骨骼的接口和层级，不共用固定身体尺寸。

## 文件与编辑入口

- `roster.json` 是比例和动作参数的制作入口；每个角色的 `proportions.json` 为随包可读副本。尺寸使用装配虚拟坐标，`height` 为同场景的相对标尺，不是人物真实身高承诺。
- 每个角色的 `parts-source.png` 为 v2 的 1254×1254 原创透明画稿，本轮保持原图不变；`parts/` 为 16 张机械裁切纹理。调整的是原生分件的装配矩阵、宽高、关节和动作，没有程序代画或把整个人统一拉伸。
- 原始图像生成的提示词保存在 `prompt-initial.txt` / `prompt.txt`，初始输入为 `origin-parts-source.png`，统一风格参照为根目录 `style-reference-wukong.png`。本轮比例制作要求在本 README、`roster.json` 与各 `proportions.json` 中保留。
- `<id>.woop` / `woop.json` 包含 16 分件、15 个连接和完整装配数据；已在隔离 Blender 5.2.2 进程通过官方 WooooShadow 0.8.13 实际导入。
- `<id>.blend` 保留独立分件、骨骼、内嵌图像和官方材质备选。胸腹胯为 `pelvis → abdomen → body → head / arms`，两腿挂在胯部。
- `<id>.glb` 是一个蒙皮网格、一个双面无照明透明裁切材质、32 三角面、16 骨骼和一张 1024×1024 图集。
- 动作为 `Idle`、各自周期的 `Walk`，另有静姿兼容用 `RestPose`；提供 `preview-idle.png` / `preview-walk.png`。只含右侧和整体镜像左侧。
- 每个 `manifest.json` 及根清单保留原图 / 运行资源哈希、字节、工具来源和未入图状态。根目录 `files.sha256.json` 为随包文件核对清单；`lineup.png` / `silhouettes.png` 是实际导出资源的同尺度截图。

制作来源为前两轮内置 imagegen 原创画稿，本轮进行原生分件和骨架修改，未新增图像生成、Tripo 积分或 InkTool 购买。官方导入器留在本机被忽略的 `.local/tools/wooo-shadow-0.8.13/`，未修改全局 Blender 偏好，未复制插件代码或作者素材进资源包。图像透明和原画色彩通过标准 glTF 节点与显式 `KHR_materials_unlit` / `MASK` 导出。

## 重建与验证

在仓库根目录使用既有 Blender，并保留上述本机导入器：

```powershell
& 'F:\SteamLibrary\steamapps\common\Blender\blender.exe' --background --factory-startup --python-exit-code 1 --python apps/xiyou/art/shadow-roster-v3/prepare.py
& 'F:\SteamLibrary\steamapps\common\Blender\blender.exe' --background --factory-startup --python-exit-code 1 --python apps/xiyou/art/shadow-roster-v3/build.py
& 'F:\SteamLibrary\steamapps\common\Blender\blender.exe' --background --factory-startup --python-exit-code 1 --python apps/xiyou/art/shadow-roster-v3/check.py
```

检查真实 WOOP、重新打开的八个 blend 和重新导入的八个 GLB：分件 / 骨骼 / 刚性权重 / 透明 / 材质预算、胸腹胯层级、各自完整步行周期的 61 个采样。另从重导入几何测量身体高度、腿长、头部与胸腹宽度，交叉比较沙僧 / 悟空的高矮、八戒 / 唐僧的腹宽、小白龙 / 八戒的腿占比与虎妖的宽肩，防止仅改配置却未改变实际模型。支撑脚检查允许透明裁切边框带来的 2 厘米范围，不等于自然步态审阅。

本机检视页 <http://127.0.0.1:8876> 使用一个相机、一个渲染器和统一地线，不再按角色独立自动放大；剪影模式隐藏兵器与配件。Edge 检查包含八个实际 GLB、独立动作周期、同尺度、实际走动 / 暂停冻结 / 翻面、剪影与分件恢复、键盘、390 宽滚动布局和减少动态。源脚本和完整截图 / 录像、`assets.json` / `browser.json` 留在 `.local/qa/shadow-roster-v3/`。

## 当前边界

造型、比例夸张、腰腹 / 衣摆衔接、自然步态、衣饰与兵器细节仍待用户看完整人物审阅。没有正背面、连续立体转身、小白龙马形、攻击受击和正式技能。本批只在资源检视中使用，尚未全部替换游戏地图人物；地图、剧情与存档未改。该检查不代表实体手机、怪海或完整游戏验收。本轮未提交、推送或部署。
