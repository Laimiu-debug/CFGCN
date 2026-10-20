# CFGCN · 四大名著网页游戏

东方绘本与立体场景氛围下的四大名著游戏系列。官网、三语、游客手记与本地数据接口已建立；西游已接入 Rust / Bevy 浏览器章节「西行初志」：唐僧独行、五行山救悟空、鹰愁涧小白龙入队，三人共享经验与培养分配，可切换领队。「山门试炼」保留为技术样板，其余三款仍为独立世界预览。正式美术与完整产品持续开发。

## 本地运行

需要 Node.js 22.12+、Rustup 与系统 C/C++ 构建工具。西游固定 Rust 1.97.1 与 Bevy 0.20.0，首次构建会下载项目工具链、WASM 目标和依赖；Windows 需安装 Visual Studio C++ Build Tools。当前验证使用 Node.js 24.19.0。

```powershell
npm ci
npm run build:xiyou
npm run dev
```

官网默认地址为 `http://127.0.0.1:5173`，西游入口为 `#/world/xiyou`。Rust 代码变化后重新运行 `npm run build:xiyou`，再刷新游戏。API 基础服务单独在另一个终端运行：

```powershell
npm run dev:api
```

健康接口为 `http://127.0.0.1:8787/api/health`；官网开发服务器代理 `/api`。本地手记和世界预览可以独立于 API 使用。

```powershell
npm run check    # 类型检查、关键测试、生产构建
npm run preview  # 预览已构建的官网，默认端口 4173
```

## 目录

```text
apps/
  website/       官网、导航、游客手记、多语言
  xiyou/         西游：Rust 客户端、Blender 源资产、三语游戏界面
  shuihu/        水浒传：世界元数据与独立预览入口
  sanguo/        三国演义：世界元数据与独立预览入口
  honglou/       红楼梦：世界元数据与独立预览入口
packages/
  shared/        类型、语言协商、游客资料与隔离存档接口
  game-core/     与渲染独立的 Rust 战斗、护送和升级规则
  ui/            设计变量、图标与共用世界预览
services/
  api/           Node.js HTTP 服务，目前提供健康检查
docs/            架构、视觉、素材来源与验证记录
```

四款游戏入口按路由异步加载；西游的 WASM 在独立 iframe 中启动和卸载。生成的 WASM / JS 包不入 Git，构建命令会输出带内容哈希的资源与版本清单。

## 已有体验

- 四幅原创场景、四世界切换、独立世界预览与错误路由。
- 简体中文、繁体中文、英文，以及浏览器语言识别。
- 游客名字、世界收藏、减少动态设置与手记 JSON 导出，刷新后保留。
- 声音默认关闭，点击后播放水墨国风短配乐与原创环境 / 游戏音效；主界面、探索和战斗共用音频控制器，支持编辑后的循环与暂停。见 [声音接入](docs/game-audio.md)。
- 按游戏隔离、带版本的本地存档接口与异常处理。
- 响应式布局、原生对话框、键盘关闭及跳到主要内容入口。
- 西游真实三维山道、移动、自动挥棍、定身、分身、护送、升级选择、妖王、胜败、重开及本地战绩。
- 西游四段初程、唐僧护持退敌、悟空解封入队、小白龙化马，自动随行迎敌、共享灵光、角色培养与本地路标续关。按 1 / 2 / 3 或队伍栏换人，空格 / E 使用当前角色本领。见 [章节与师徒队伍](docs/xiyou-journey.md)。

西游悟空与白龙马已使用现有 Studio 会员生成，经 Blender 修整、绑骨与三段动画后，游戏运行版分别约 878 KB / 690 KB。程序包支持 gzip 下载；新增白龙马、龙形、水妖与水岸 GLB 共约 1.71 MB，在鹰愁涧首次进入时加载。游戏采用沉浸式 HUD、角色头像与血条换人；人物、敌人与地图仍需整体美术精修。账号认证、云存档、排行榜与完整西行地区尚未实现，其他世界仍为视觉预览。详见 [西游样板与资产流程](docs/xiyou-prototype.md)、[章节与师徒队伍](docs/xiyou-journey.md)及[连续地图与连携方案](docs/xiyou-world-and-links.md)。

## 项目资料

开发预览已发布到现有大服务器：[主站](https://fourealms.com/)，四款分别使用 `xiyou`、`sanguo`、`shuihu`、`honglou` 子域名。五个入口均有 HTTPS；西游可玩，其余三款仍为世界预览。发布快照、续期、访问验证与后续更新方式见 [部署域名与站点入口](docs/deployment.md)。

- [设计思路与产品范围](https://www.notion.so/3266ce920d57483a846ae453fa16a74c)
- [部署与服务器连接](https://www.notion.so/3fd5946e36988146b7b5fd4f0fd56674)
- [开发进度与建议](https://www.notion.so/3fd5946e3698819c94a6efbd903e3f46)
- [GitHub 仓库](https://github.com/Laimiu-debug/CFGCN)

Notion 页面需使用有权限的账号访问。

## 协作

开始工作前阅读 [AGENTS.md](AGENTS.md)。项目建议、方案、决定及完成情况均需同步到对应的 Notion 页面，并附实际验证结果和相关提交链接。

服务器连接元数据在 Notion 部署页维护；密码、私钥和令牌保留在本机受限文件中，不提交到仓库或 Notion。

## 开发资料

- [工程与视觉基础](docs/foundation.md)
- [原创素材与生成提示词](docs/artwork.md)
- [API 边界](docs/api-contract.md)
- [验证记录](docs/validation.md)
