# CFGCN · 四大名著网页游戏

东方绘本与立体场景氛围下的四大名著游戏系列。已建立第一轮工程与视觉基础：统一官网、四个独立世界预览、多语言、游客手记与本地数据接口。完整游戏玩法仍在规划中。

## 本地运行

需要 Node.js 22.12+。本轮验证环境为 Node.js 22.23.3、npm 10.9.9。

```powershell
npm ci
npm run dev
```

官网默认地址为 `http://127.0.0.1:5173`。API 基础服务单独在另一个终端运行：

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
  xiyou/         西游记：世界元数据与独立预览入口
  shuihu/        水浒传：世界元数据与独立预览入口
  sanguo/        三国演义：世界元数据与独立预览入口
  honglou/       红楼梦：世界元数据与独立预览入口
packages/
  shared/        类型、语言协商、游客资料与隔离存档接口
  ui/            设计变量、图标与共用世界预览
services/
  api/           Node.js HTTP 服务，目前提供健康检查
docs/            架构、视觉、素材来源与验证记录
```

四款游戏入口按路由异步加载，后续按玩法需要引入各自的游戏引擎和运行时。

## 已有体验

- 四幅原创场景、四世界切换、独立世界预览与错误路由。
- 简体中文、繁体中文、英文，以及浏览器语言识别。
- 游客名字、世界收藏、减少动态设置与手记 JSON 导出，刷新后保留。
- 默认关闭的原创五声音阶环境音，需要点击后开启。
- 按游戏隔离、带版本的本地存档接口与异常处理。
- 响应式布局、原生对话框、键盘关闭及跳到主要内容入口。

账号认证、云存档、排行榜、完整游戏和生产部署尚未实现。世界插画用于视觉预览，尚不是可操作的 3D 场景。

## 项目资料

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
