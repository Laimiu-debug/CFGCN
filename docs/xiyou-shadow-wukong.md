# 平面皮影悟空地图样板

2026-10-20（Asia/Hong_Kong）。用户已授权按《通神榜》的平面人物表现，先制作一位平面皮影悟空，放入现有地图观察行走与转向。当前已完成本地运行样板，人物画稿、步态与场景搭配待用户审阅。没有提交、推送或生产部署。

## 试走入口与范围

构建后在官网的西游入口进入当前地图；本机预览为 <http://127.0.0.1:4173/#/world/xiyou>。桌面使用 WASD / 方向键，手机使用左下浮动摇杆。右上停步冻结场景，再点继续行走恢复。

保留当前镜头与地图。左右移动时整幅皮影翻面；上下移动、停步和地图定位保留最近朝向，展示面始终朝向当前相机，不会随着八方向移动转成薄边。部件随步态转动，双腿交替支撑 / 抬脚，手臂、头、尾与棍保留小幅动作。地图脚点、地形高度、原有投影和树石深度关系继续使用真实世界坐标。

用户追问“只画图，不生成模型，转向怎么做”后补充说明：当前画稿之后还制作了带关节的平面网格模型并导出 GLB。走路由关节驱动分件；当前所谓转向仅为左右朝向切换，没有正面 → 侧面 → 背面的连续转身，单张侧面画稿不会自动提供背面。若需向上露背、向下露正面，需要补对应视角分件并适配动作；也可另用立体原型制作多视角画面。多方向扩展尚未由本次追问确认或实现。

仅地图外观加载皮影悟空；模拟继续使用原踏勘行者槽位，不代表剧情已经救出或招募悟空。踏勘存档 `cfgcn:map:xiyou:v1` 与旧战斗存档 `cfgcn:save:xiyou:v1` 分开。显式进入旧战斗后仍加载旧角色和章节资源。

## 原创资源与实现

金箍、赭黄衣、朱砂腰带、黛绿裤、尾巴和金箍棒构成侧面悟空。使用内置图像生成制作原创分件画稿，没有导入《通神榜》素材。该样板走直接二维路线，不需要 Tripo 三维原型，没有安装五天晴或其他第三方插件，也没有消费 Tripo 积分。Blender 脚本用于本项目制片与导出，尚未包装成通用插件。

| 内容           | 路径 / 数值                                                                  |
| -------------- | ---------------------------------------------------------------------------- |
| 原始透明画稿   | `apps/xiyou/art/shadow-wukong/parts-source.png`，1448×1086                   |
| 完整生成提示词 | `apps/xiyou/art/shadow-wukong/prompt.txt`                                    |
| 可编辑源       | `apps/xiyou/art/shadow-wukong/shadow-wukong.blend`，内嵌原画                 |
| 制作脚本       | `apps/xiyou/art/shadow-wukong/build.py`                                      |
| 导出重导入检查 | `apps/xiyou/art/shadow-wukong/check.py`                                      |
| 来源与哈希     | `apps/xiyou/art/shadow-wukong/manifest.json`                                 |
| 游戏资源       | `apps/website/public/games/xiyou/assets/shadow_wukong.glb`                   |
| 运行成本       | 618,032 字节；14 刚性平面部件，28 三角面，15 骨骼节点，1 材质，1024×768 图集 |
| 动作           | `Idle`、`Walk`；`RestPose` 仅为旧动画图兼容静姿，不是新增技能                |

原画 SHA-256 为 `796852eccc5ebef3921770e4bd8867b47e31ef0819d231727e0fd05eff9a32bb`；当前 GLB 为 `cae7741e549b28f6c80f844f1e4fb882afcbd647c2675d4b67a81885ccdf4fc2`，重建后的当次值以清单为准。

Blender 5.2.2 将头、躯干、尾、两侧上臂 / 前臂、大腿 / 小腿 / 脚及棍做成平面，UV 窗口对应原画，顶点按部件刚性绑定。步幅与接触段沿用地图行走配置；专用平面腿部解算保持承重脚底稳定。运行 GLB 使用双面、无照明颜色和 alpha 遮罩；共用着色器显式丢弃透明像素，避免出现矩形底或以体积阴影压暗画稿。

`main.rs` 的地图资源入口与朝向处理、`paint.rs` / `series_paint.wesl` 的透明画稿分支、`boot.js` / `scripts/xiyou-resources.mjs` 的按需资源清单及三语地图标签已接入。共用变量与按钮状态没有另起色板。

## 重建与检查

在仓库根目录，使用本机已有 Blender；其他机器替换可执行文件路径：

```powershell
& 'F:\SteamLibrary\steamapps\common\Blender\blender.exe' --background --factory-startup --python-exit-code 1 --python apps/xiyou/art/shadow-wukong/build.py
& 'F:\SteamLibrary\steamapps\common\Blender\blender.exe' --background --factory-startup --python-exit-code 1 --python apps/xiyou/art/shadow-wukong/check.py
npm run build:xiyou
npm run build --workspace @cfgcn/website
npm run check
```

必须使用 `--python-exit-code 1`，否则 Blender 可能在 Python 抛错时仍返回成功。运行清单和网站构建需要在角色 GLB 更新后一起生成，不能只替换源文件。

当前最终客户端 `client-dd66102a4521.wasm`，原始 26,262,660 字节，gzip 6,135,768 字节。人物资源轻量不代表引擎首包已缩小，也不代表怪海性能已验收。

## 本轮实际验证

- 完整 `npm run check` 通过：12 份 JavaScript 测试文件共 58 项、Rust 46 项、格式 / Clippy、类型、美术与地形约束、队伍 / 章节模拟及生产构建。最后的透明材质识别修正另经 Clippy、WASM 与官网构建及下述浏览器检查通过。
- 从 GLB 新开 Blender 重导入，核对唯一蒙皮网格、15 关节、刚性权重、图集、遮罩、动作顺序、字节与哈希。步行采样 61 帧，41 个接触样本，承重脚底最大局部误差约 0.00000037；该数字是导出动作约束检查，不是用户对自然步态的认可。
- 本机 Edge 无头浏览器共 29 项检查通过，无页面 / 控制台错误。桌面 1440×900 的前后左右纯轴各 1.35 秒约移动 11.5 地图单位，另查斜向、实际左右画面和停步。暂停后的两张画布截图哈希完全相同，验证实际角色与场景冻结。
- 刷新恢复踏勘坐标；地图运行前后旧战斗存档逐字节一致；显式进入旧战斗后仍能恢复三人章节检查点。测试存档只注入隔离浏览器，未改用户浏览器资料。
- 390×844 / 844×390 触屏模拟使用实际 CDP 多指事件：摇杆横移、第二指停步、触摸取消和横竖屏切换停止。三语 320 窄屏与减少动态设置通过布局检查。属于浏览器模拟，实体手机待验。
- 地图实际只请求皮影悟空、树、地被和山石四个 GLB；旧三维人物与河岸战斗包在显式进入旧样板后请求。保留既有按哈希缓存和地块释放机制，本轮未重新验收所有缓存 / 释放边界。

证据留在 `.local/qa/`：`shadow-wukong-asset.json`、`shadow-wukong-browser.json`、`shadow-wukong-check.log`、`shadow-wukong-clippy.log`、`shadow-wukong-build.log` 与 `shadow-wukong-web-build.log`。隔离浏览器脚本为 `.local/qa-shadow-wukong.mjs`，另有仅录制走动转向的 smoke 脚本与 `shadow-wukong/smoke.json`。截图与视频在 `shadow-wukong/`，重导入近景在 `shadow-wukong-source/`；本机 QA 资料不提交。

## 当前差距与下一步

样板首先用于判断平面皮影置入当前镜头的效果。当前左右是整幅镜像，持械手与不对称纹样一起镜像；上下移动没有另画背面。纹样尚未完成完整透光镂刻，当前脚点与比例、部件接缝、步幅、手机缩小后的细节和现有地表的搭配仍需用户看实际录像 / 试走。

地图、官网和其他角色尚未整体迁移为水墨，原场景纹理密度也未因这次人物样板重做。没有新增攻击或受击动作、角色技能、怪海压力结果或全路线验收。后续先根据本样板的画面反馈修正人物与场景取舍，再按地图优先顺序推进，不把工程检查通过写作全项目最终美术认可。
