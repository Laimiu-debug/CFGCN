# 西游皮影资源 v4：腿、兵器与步态返工候选

2026-10-20。用户连续指出缺少腰腹、角色比例相同，随后进一步指出所有腿、兵器比例和走动姿势有问题。旧 v1–v3 作为历史保留；当前仍为待审候选，不把工程检查通过称作用户认可。

## 本轮实质修改

- 八套下身重新绘制大腿、小腿、低帮鞋与下衣，裤腿有体积，去掉误导胯 / 膝 / 踝结构的大圆轴。保留头脸、胸腹、手臂与饰物身份；各自高矮、胖瘦、四肢尺寸继续独立配置。
- 分件采用纵向 / 横向基底映射，画稿近端和末端准确落在关节上。脚片与小腿分开，踝轴位于鞋与小腿的衔接处，避免把整段靴筒当作脚掌转动。
- 改正向后折膝的求解分支；行走具有双支撑、落跟、平脚承重、推蹬与抬脚回摆，降低夸张抬腿。重心、胸肩、持械臂和自由手臂随动；每个角色使用不同步长、步频、抬脚与重心。
- 八件兵器分别重画，调整头部 / 杆身构成，再按人物相对尺寸确定长度、杆径、握点和携行角度。金箍棒与禅杖保持长而细的杆身，耙 / 铲 / 斧头不过度放大；剑、刀和法杖各自配置。细部形制与画稿继续待审。

## 来源与编辑文件

使用内置 imagegen 生成 8 份原创下身分件画稿与 8 件独立兵器；每个角色分别保存 `lower-body-source.png` / `lower-body-prompt.txt` 与 `weapon-source.png` / `weapon-prompt.txt`。对应原始风格输入为各自 `parts-source.png`，旧 `prompt.txt`、`prompt-initial.txt`、`origin-parts-source.png` 和根目录风格参照继续保留。`parts/` 是机械裁切的 16 个分件，`runtime-atlas.png` / `.json` 是机械排布的图集与 UV 区域，不是程序重画。

`roster.json` 是身体与动作参数的制作入口；各 `proportions.json` 为随包副本。所有尺寸是设计用的相对场景标尺，不是人物真实身高考据。每个角色有：

- `<id>.woop` / `woop.json`：16 分件、15 连接、独立枢轴、装配矩阵及原图区域。
- `<id>.blend`：16 个可独立编辑部件、16 骨骼和内嵌图像；保留官方材质备选。
- `<id>.glb`：一个蒙皮网格、一个双面无照明 alpha 裁切材质、32 三角面、16 骨骼、一张 1024×1024 运行图集。
- `Idle` / `Walk` / 静姿兼容 `RestPose`，以及整装 `preview-idle.png` / `preview-walk.png`。当前仅右侧与整体镜像左侧。
- `manifest.json`：原画、下身、兵器和运行资源哈希、字节、来源及步长 / 支撑占比 / 周期。根清单汇总八套；`files.sha256.json` 核对随包文件。

实际在隔离 Blender 5.2.2 进程加载官方 WooooShadow 0.8.13 导入全部 WOOP。第三方导入器仅位于本机被忽略的 `.local/tools/wooo-shadow-0.8.13/`，未修改全局偏好、复制插件代码或使用作者素材库；没有新的 Tripo 生成 / 积分、InkTool 购买。新原图与旧文件分别保留。

## 重建与检查

```powershell
& 'F:\SteamLibrary\steamapps\common\Blender\blender.exe' --background --factory-startup --python-exit-code 1 --python apps/xiyou/art/shadow-roster-v4/prepare.py
& 'F:\SteamLibrary\steamapps\common\Blender\blender.exe' --background --factory-startup --python-exit-code 1 --python apps/xiyou/art/shadow-roster-v4/build.py
& 'F:\SteamLibrary\steamapps\common\Blender\blender.exe' --background --factory-startup --python-exit-code 1 --python apps/xiyou/art/shadow-roster-v4/check.py
```

`motion.py` 保存动作；`atlas.py` 只打包纹理；`verify.py` 由 `check.py` 调用。检查八个 WOOP、重开的原生文件、重导入 GLB，核对图像内嵌、刚性权重、预算、材质和 121 个完整步行周期采样。测试从真实图集 alpha 轮廓取鞋底，检查膝盖朝向、承重接地、无步行腾空、双支撑、循环首尾与叠加步长后的固定鞋底特征漂移。平脚承重漂移使用同一图像特征，不能逐帧换最低点来测不同位置。

本轮八个运行文件合计 9,898,260 字节，单个 1,025,720–1,361,500；每个仍在 1.5 MB 制作预算内。整批包体不是地图同时下载量。当前平地重导入检查没有步行腾空，支撑脚 alpha 轮廓最大偏差小于 0.0015 场景单位，平脚支撑的固定鞋底特征漂移小于 0.0001 场景单位；这些是导出轨迹检查，不代表斜坡、转弯或自然步态认可。

本机检查入口 <http://127.0.0.1:8877> 支持八人同尺度比较、单人放大、沿地线往返、半速、动作进度、剪影与镜像。实际 in-app browser 已载入八套资源并观察首轮悟空静姿；后续浏览器截图 / 点击的 CDP 发生超时或无有效视口，未取得最终浏览器完整周期录像，不把它写成完整浏览器动态视觉验收通过。相关状态与边界如实保留，预览代码位于 `.local/qa/shadow-roster-v4/`。

`studies.py` 从保存的 Blender 角色生成 `lineup.png` 同尺度整装图，以及各自 `walk-cycle.png` 的 0 / 25 / 50 / 75% 关键姿势。另用 `runtime_motion.py` 重新导入实际悟空 GLB，将自身步长叠加到世界位移，在固定地线前渲染三个完整步行周期，再由 `encode_motion.py` 使用 Blender 内置 H.264 编码生成 `wukong/exported-glb-walk.mp4`（64 帧、24 fps、1024×768、约 2.67 秒）；已逐帧解码检查。这是导出模型检视录像，不是游戏实录。QA 的 `assets.json`、`video.json`、原始帧、构建 / 检查日志保存在 `.local/qa/shadow-roster-v4/`。

## 当前边界

完成八套本地资源返工和专项检查；画稿、腿脚衔接、自然步态、持械和细部形制仍需看实际整装审阅。尚未全部换进地图，没有正背面、多方向连续转身、马形、攻击受击与正式技能，没有以该检视页冒充实体手机、怪海或完整游戏验收。本轮不修改地图、剧情、存档，没有提交、推送或部署。
