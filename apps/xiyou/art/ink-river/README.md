# 鹰愁涧岸线水墨布景

2026-10-20，延续已认可的房屋 / 林木画风，制作斜生岸柳、低矮芦苇与临水卧石。用于现有自由探索地图的河岸组合，不是新的白龙任务、正式生态或完整河谷交付。

## 来源与制作

- 已接收的 Tripo Studio 树、山石与地被原型及 Blender 投影保留于 `../ink-world/studio-projections.png`、`projection-sources.json`；已认可柳树风格参考为 `../ink-hamlet/willow-source-v1.png`，其 Studio 河岸原型、来源哈希和投影在 `../ink-hamlet/manifest.json`。这次复用已完成的类别原型，没有新 Studio 任务、积分消费或软件安装，不称本批为新 Tripo 三维生成。
- 三张新画稿分别由内置 imagegen 生成，提示词明确透明背景、完整轮廓、实际脚点和克制水墨设色；保持枝叶与石纹细节，避免摄影材质与站立石柱。透明原件留在本目录，不覆盖获认可的旧柳树或 Studio 原型。
- `prepare.mjs` 仅裁透明边、缩放和打包，不语义重绘 / 减色。2048×2048 RGBA 图集，底部 alpha 加权根点用于 Blender 枢轴；每张原图与图集的完整 SHA-256 见 `packing.json`。
- `build.py` 制作三个场景、一个材质、一张图集的 `ink_river.glb`；可编辑 `../source/ink_river.blend` 内嵌图像。`check.py` 在新的 Blender 进程重导入三个场景，核对来源 / 运行哈希、尺寸、UV、面数和底部落点。

| 画稿     | 完整提示词                             | 透明原件                                     | 原始生成输出                                  |
| -------- | -------------------------------------- | -------------------------------------------- | --------------------------------------------- |
| 斜生岸柳 | [willow-prompt.txt](willow-prompt.txt) | [willow-source-v1.png](willow-source-v1.png) | exec-7ddfc8df-0cdf-477c-8a3d-3eb9ed59e136.png |
| 芦苇     | [reeds-prompt.txt](reeds-prompt.txt)   | [reeds-source-v1.png](reeds-source-v1.png)   | exec-1c2cfc5d-b81a-485c-9934-a1509c50ac6c.png |
| 卧石     | [slate-prompt.txt](slate-prompt.txt)   | [slate-source-v1.png](slate-source-v1.png)   | exec-685095d6-07eb-485e-aa1a-94d6bb8aa2a0.png |

当前运行包 3,498,976 字节，6 三角面 / 12 顶点 / 三场景 / 三基本图元，无骨骼和动画，SHA-256 `14ed1cc33378c3cd740f193cfceae2906e14cfef9e95a5ade3a2db8ab0b4031a`。画稿宽分别 7 / 2.8 / 3.6 米，实际世界按同源实例尺度摆放。当前开发版优先画面，保留 RGBA 画质；文件结构和面数不是性能、加载或怪海结论。

地图图形从同一画稿生成，图集增至 22 项；位置、尺度与草木 / 石头类别由 Rust 实际地图提供。低矮芦苇不挡人，也不套高树阴影；岸柳与卧石按实际根 / 石脚保留碰撞。具体布置、实跑与尚未完成项见 [岸线制作记录](../../../../docs/xiyou-riverbanks.md)。原画和实际搭配继续待用户审阅。
