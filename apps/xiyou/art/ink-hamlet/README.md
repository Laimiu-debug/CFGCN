# 郊野村居水墨资源

地图优先阶段的原创游戏样板；完整场景形式与画稿仍待审阅。制作与实跑记录见 [地图文档](../../../../docs/xiyou-hamlet-and-ground.md)。

- 民居参考来自已接收的 Tripo Studio `village`，项目 `c1197061-13d8-4b1f-ae6b-5caaec529fc7`；河岸体量参考为 `riverbank`，项目 `42ff52bc-d6fa-4557-8d3c-afd9b8d0b62c`。没有新的 Studio 生成、积分消费或软件安装，原始模型未改动。
- `render_sources.py` 保存 Blender 投影及来源记录到 `projection.json`。河岸参考的树偏棕榈形，只用于体量参考；柳树是原创修绘，不能将原模型标为已经生成的合格柳树。
- `house-source-v1.png`、`willow-source-v1.png` 是两次内置 imagegen 输出原件；完整提示词为 `house-prompt.txt`、`willow-prompt.txt`。原画是透明背景，并非游戏截图。
- `prepare.mjs` 仅裁透明边、缩放和打包；`packing.json` 保留原画与运行哈希、尺寸和实际根部锚点。
- `build.py` 生成两个共用场景、一个材质、一张 768×1024 图集；可编辑源为 `../source/ink_hamlet.blend`，运行包为 `../../../website/public/games/xiyou/assets/ink_hamlet.glb`，126,088 字节 / 4 三角面。
- `check.py` 在新开 Blender 中重导入，核查原画 / 运行哈希、真实尺寸、UV、透明模式与脚点。

民居为原创新西游游戏改编的简朴木构瓦房，不声称具体朝代古建复原；门当前关闭，院落与屋侧可绕行，未制作室内、居民、任务或经营。菜畦是现有地面上的静态笔触，不是独立三维作物或可交互种植系统。
