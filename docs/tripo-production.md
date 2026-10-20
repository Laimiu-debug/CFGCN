# Tripo 游戏资产流程

最新工具状态（2026-10-20）：已按用户要求安装并启用 WooooShadow 0.8.13，InkTool 因用户尚未购买仍待安装；备份、实际检查和范围见 [Blender 工具安装记录](blender-plugins.md)。下文此前“未安装插件”的内容保留为对应制作轮次的历史状态。

统一方向以 `art-direction.md` 为准。使用用户现有 Studio 会员，不因 API 积分不足充值。本轮没有安装额外软件，使用已有 Blender 5.2.2。角色、敌人和场景最终在同一 Rust 游戏镜头中验收，生成截图不是交付终点。

## 官网连续地形与独立场景物件（2026-10-20，建议待验证）

后续执行状态：用户授权先试纸片高差、效果不好退回原版。本轮使用既有细笔画稿制作连续低坡与独立山体折面 / 城墙 / 主建筑的网页试验，没有新 Tripo 任务、积分消费、插件采购或 Blender 模型交付。弱透视 / 正交对照后，切边和侧看连续性仍不如 v3，独立预览已默认退回保留的 v3；试验不是已接收正式资产。具体来源、检查与退回依据见 `website-atlas.md`。下文仍为先前建议，不能因此启动批量地形生成或将未确认工序写成已实施。

后续讨论补充：用户提出参考《纸片马里奥》，担忧重新堆完整模型和初版卡顿。当前增加“连续高差地面 + 竖直画片 / 折面 / 薄壳”的候选方式，不能把下文 Tripo 整块地形初模当作已确认前置。原生曲线、轮廓画片与局部画稿可直接制作；需要造型的代表模型继续优先使用现有 Studio → Blender。先保证整幅布局、山脚 / 河岸接地、细笔质量与真实镜头，再实测透明叠层、合批和运行帧时间，不能以纸片化承诺性能。详见 `website-atlas.md` 的“纸片舞台与竖向空间”。本轮仍仅讨论 / 文档，无新资产生成或收费。

用户否定官网 v4 整幅画稿浮雕及预览缩放，提出先用 Tripo 建地形模型、再在地形上添加模型。建议使用现有 Studio 试制无建筑 / 树木 / 人物的地形初模或主山系，保留完整提示词、任务来源、原件和哈希；在 Blender 中按整幅样张统一地理关系、尺度、山脚、河谷和城镇占地，将地表修整连贯，再导入独立城镇 / 树石等物件。空间结构保留为真实网格，细笔水墨由局部画稿 / 分色 / 笔触与统一渲染表达；样张仅作构图和美术参照。

先验证整幅地形与真正地图镜头的平移、指向地面点缩放、俯角 / 范围限制，再增加细节和活动实体。不能把生成底座逐块摆回平面或承诺一次生成正确全国地理；Blender / 场景组装承担连续地貌和接地的制作责任。具体区域输入、生成质量和网页保真仍待实做，当前仅建议，没有新的 Studio 任务、积分消费、模型输出或运行迁移。

2026-10-20 核对 [Tripo Studio 官方教程](https://www.tripo3d.ai/blog/tripo-studio-tutorial-english)：支持先无贴图基础网格，再分割 / 重拓扑 / 贴图；[官方环境资产流程](https://www.tripo3d.ai/blog/ai-generated-environment-assets)区分地形结构、独立资产和下游引擎组装。上述首页工序是本项目拟定的制作方案，不能以官方功能表替代连续地形、地图地理或水墨效果实测。该节仅适用于本次官网讨论，其他游戏沿用各自已确认的当前阶段。

## 水浒静态糖塑棋子（2026-10-20，三枚试制已确认）

用户已确认水浒采用立体琥珀糖塑收藏棋与共用水墨界面，先用现有 Studio 试制林冲、鲁智深、扈三娘。先完成总体规格、人物 / 兵器底册与每枚独立完整提示词，再提交生成。水浒静态雕塑不用中立 A 姿态、绑骨或蒙皮；仍须 Blender 修形、兵器 / 手部拆分、材质、毫米尺寸、精细检视档 / 战场档、GLB 重导入与实际网页镜头检查。Studio 生成或 PBR 贴图不证明糖质透射 / 厚度已在游戏保留。

本批是水浒专用例外，不能把西游的平面皮影规范删掉。108 将与 60 名扩展人物第一版、54 类兵器 / 身份道具提示词位于 `apps/shuihu/art/pieces/`，重建只生成文本，不调用服务、不消费积分、不覆盖模型。实际 Studio 任务、报价、原件、SHA-256、Blender 源与人工审阅状态在该目录 README / manifest 中记录。总体与边界见 [制作规格](shuihu-piece-production.md)。

用户审阅后进一步确认全身糖塑、约五头身、体态敦实与鲜明衣甲设色。v2 使用 `appearance.tsv` 的逐人头身比 / 配色，全部人物 / 空手人体 / 器物提示词按 Studio 当前 1000 字符上限核对。正式人物和兵器分开制作 / 组装；整装提示词用于造型研究，不能当作已经可独立活动的装备。首轮三枚实际输入已另存 `source/prompts/studio-v1/`，原件与项目状态在 `production-manifest.json` 保留，不用更新后的提示词追认旧模型。文本更新没有生成新模型或消耗积分。

用户随后明确要求看几个模型，已按 v2 再生成林冲、鲁智深、扈三娘，实际输入另存 `source/prompts/studio-v2/`，本批消耗现有 150 积分；三个 Studio 项目、各自三角面和完整预览截图 / 哈希已记录。原始 GLB 本地导出尚未取得文件，不能标为归档完成。林冲多余枪尾刃、鲁智深持杖姿势和整体糖材质 / 分件仍须修整；当前只完成生成与正面预览，没有完成最终造型 / 背面 / 网页模型检视验收。见水浒底册 README 与制作规格。

### 水浒陶塑试制与旧件材质实验

用户随后认为 v2 不如第一版、辨不出糖塑，要求试陶瓷。已独立按 `experiments/ceramic-v1.json` 生成三枚新 Studio 试稿，实际输入在 `source/prompts/studio-ceramic-v1/`，本批 150 个现有积分、余额 23,955 → 23,805；无充值、升级或绑骨。三份输入、三张完整工作台预览与项目 / 截图哈希在 manifest 留存，共九条生成历史。釉彩 / 素胎对照已有正面预览，鲁智深金属感杖与皮肤褐斑、扈三娘缺一刀仍待修；新三枚尚未本地导出 GLB，不能称原件归档、材质通过或全员转陶瓷。

另复用首版林冲已归档 GLB，在 Blender 创建真实釉面 / 素胎材质，保存可编辑 `.blend`、原始源哈希、重建脚本与正背实渲；不改原件几何、不消耗新积分，不能算第四枚新生成。程序素胎遮罩、旧枪形仍有差距，材质尚未烘焙 / 导出或网页验证。两种来源与制作环节分开记账，详见 [陶塑试制](shuihu-ceramic-trial.md)。最终风格与批量仍待实际审阅，168 人糖塑底册不由试验自动替换。

## 水墨与平面皮影路线（2026-10-20，方向已确认，转换尚未实测）

用户已确认人物采用真正平面皮影。Tripo 作为可选的三维原型与造型来源参与，最终交付是可独立活动的分层平面皮影片；不继续默认交付完整三维人体。需要三维建模的代表资产仍优先走现有 Studio，直接二维画稿与皮影片沿用无需 Tripo 建模的既有边界。

建议流程：

1. 先确定原创侧面皮影画稿、清楚剪影、镂刻纹样、克制设色和部件分层，四肢与兵器分开，保留关节连接区。
2. 需要 Tripo 原型时，用画稿或文字生成造型；可尝试薄片 / 浮雕描述，但不以提示词保证输出一定平整、分件或可用。保留原件、提示词、来源哈希和当次成本。
3. Blender 按选定侧面正交投影原型取得轮廓与可用纹理，再按头、躯干、上臂、前臂、手、腿、脚及兵器重建平面 / 极薄片体。不要沿单轴压扁完整人体；原型已有的遮挡与体积错误不会随压扁消失。
4. 每片设局部关节与稳定叠放关系，重做皮影式待机、步行、施技、受击与收势。镂刻用实际孔洞或经验证的透明遮罩表达；正反面、透明排序、接地和多方向切换均在运行镜头检查。Tripo 普通三维自动绑定不能替代这一步。
5. 导出网页可读的网格 / 纹理 / 骨骼动画；若采用序列图备选，另查方向数量、下载量、显存与动作切换。先以一位角色验证路径，再确定生产格式，不能提前宣称批量转换已完成。

若已有原创二维皮影画稿可直接拆片，可直接进入 Blender 分层与关节制作，不必先生成再压回二维。Tripo 参与程度以实际轮廓质量与返工成本判断。场景布景技术形式仍待确定；人物平面化不改变地图优先顺序或自动取消前后左右移动。

依据：[Tripo Studio 官方教程](https://www.tripo3d.ai/blog/tripo-studio-tutorial-english)介绍三维生成、分割、重拓扑、贴图、自动绑定和 FBX / GLB 导出。本流程是基于这些能力提出的加工方案，尚未验证 Tripo 原型到合格平面皮影的实际效果；方向讨论阶段未生成、消费积分、安装插件或迁移运行时。

2026-10-20 已按用户要求完成首个悟空地图样板，走直接二维画稿 → Blender 拆片、刚性关节与动作 → GLB 路线。使用内置图像生成制作原创分件画稿，沿用本机 Blender 5.2.2，无第三方插件、Tripo 生成或积分消费。原画、提示词、可编辑源和源 / 运行哈希保存在 `apps/xiyou/art/shadow-wukong/`。导出后重导入和当前地图实跑检查通过，画稿 / 步态待用户审阅；这验证了直接二维路线，不证明 Tripo 三维转换路线已验证。详见 [皮影悟空样板](xiyou-shadow-wukong.md)。

### 本地皮影批量资源实跑补记（2026-10-20）

用户已授权制作第一批八种西游角色。初版因胸衣直接挂腿、腰腹 / 骨盆缺失被用户否定；当前已在 `apps/xiyou/art/shadow-roster-v2/` 补完整胸腹胯结构，每套 16 分件、16 骨骼，提供透明画稿、WOOP、Blender 与 GLB。实际在隔离 Blender 5.2.2 进程调用官方 WooooShadow 0.8.13 的导入入口，核对源文件和导出资源；未修改全局偏好或复制第三方代码到项目。白色头发 / 衣服保留原始 alpha，运行材质另作标准节点适配；未运行灯箱合成或 InkTool，不能把本批当作两款插件全部效果均已验收。

这验证了本批原创建图与分件包的官方导入及基础导出，不验证 Tripo 三维转皮影。用户随后指出所有角色身体比例一样，v2 撤回为当前造型候选，保留腰腹修正历史。v3 在 `apps/xiyou/art/shadow-roster-v3/` 直接编辑现有原生分件尺寸与关节布局，分别设计八种头身 / 肩腰 / 四肢比例、站姿和步态；仍实际调用同一官方导入器生成可编辑 Blender 与 GLB，没有重新生成或程序重画源图。检视页用同一地线、同一相机比例并排，并可隐藏兵器比较剪影。

本批只进入独立资源检视，比例夸张、形体衔接、文化细节与自然步态继续待用户审阅；当前游戏地图、剧情与旧存档未替换。来源、脚本、原始提示词、比例配置、哈希和验证边界见 v3 资源目录 README。本轮没有 Tripo 生成、积分消费、提交、推送或部署。

用户随后继续否定 v3 的腿、兵器比例和走动。v4 在 `apps/xiyou/art/shadow-roster-v4/` 使用内置 imagegen 分别生成八份原创下身七分件画稿与八件独立兵器，保留原图、风格输入、完整提示词和哈希，再由本机 Blender / 官方 WooooShadow 导入装配。下身替换包含大腿、小腿、低帮鞋和下衣，保留其余人物身份；不是只把旧脚片拉长或改整体尺寸。已修正纵向关节映射、正向屈膝、真实踝位、双支撑、足底轮廓落脚与鞋掌滚动，并将兵器长度 / 粗细 / 握点分别配置。新图集只做纹理机械打包，不用程序代画原画。没有新的 Tripo 生成 / 积分消费、InkTool 购买或全局插件安装。

本版需通过导出重导入、整周期真实脚底接触 / 膝向 / 双支撑 / 叠加位移滑步检查，并逐个实看放大站姿、左右走动和持械。旧 v3 变为问题对照，前序功能检查作为历史保留；当前候选和实际证据见 v4 README，未因此完成全部游戏人物、多方向、战斗动作、手机或怪海。

### Tripo 在皮影路线中的用途建议（2026-10-20）

场景用途已形成首轮实际样板，见 [水墨地图样板](xiyou-ink-world.md)：复用既有 Studio 树木、山石、松岩与地被，经 Blender 正交投影、内置 imagegen 原创水墨修绘，再制成共用平面布景 GLB。原型、三份完整提示词、源哈希、画稿与可编辑源保留；没有新的 Studio 生成或积分消费，也没有用第三方插件完成这些布景。该场景加工已导出重导入并在地图实跑，不把其成功扩大为 Tripo 人物关节皮影转换或一键插件已验证。

首四区 [地标样板](xiyou-map-landmarks.md) 另复用既有 Studio 建筑的屋顶 / 立柱与山石参考，经同一投影、原创修绘和 Blender 流程接入路亭、石峡、五峰与路石。参考投影、完整提示词、原画、打包 / 运行哈希与可编辑源保存在 `apps/xiyou/art/ink-landmarks/`；本轮没有新的 Studio 生成或积分消费，没有修改原神龛模型或恢复暂停的神龛功能。地标画稿是原创文学场景意象，不称历史复原。

郊野村居另复用既有 Studio `village` 与 `riverbank` 原型，源投影、两份完整提示词、原始画稿、哈希与 Blender 源见 `apps/xiyou/art/ink-hamlet/README.md`。旧河岸树偏棕榈形，只取体量参考并原创修绘为柳树，不能称原模型是合格柳树或纯自动转换。两类图形共用 126,088 字节的运行包；当前为地图布置样板，无新 Studio 生成 / 积分消费。完整实现与实跑见 [地表与郊野村居](xiyou-hamlet-and-ground.md)。

针对用户询问 Tripo 还能做什么，当前建议将其主要用于需要三维造型的场景与道具原型；人物方面作为可选的多视角造型来源。官方 Studio 教程确认文字 / 图片生成三维模型、部件分割、重拓扑、贴图、绑定与 FBX / GLB 导出能力；以下是本项目分工建议，不是对新样板效果的实测结论。

| 用途                           | 本项目中的做法                                                                                                 |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| 山石、树木、寺庙、门楼、桥梁   | 需要立体空间时先做代表原型，再经 Blender 修形、减面与统一水墨表现；场景最终采用三维承载或平面布景仍待样板决定  |
| 棍、法器、灯笼、宝箱等道具     | 生成可复用原型，再修比例、纹理与网页预算，或渲染成平面素材                                                     |
| 悟空、妖怪、坐骑与首领造型参考 | 可先生成三维原型，检查正侧背比例，在 Blender 渲染多角度后修成皮影画稿 / 分件；不把体积模型直接当作正式平面角色 |
| 自动绑定与动作                 | 可用于三维原型预览和动作参考，不能替代皮影关节布局、分件遮挡与正式步态制作                                     |

Tripo 输出的三维网格与 WooooShadow 导入的 WOOP 分件角色不是同一输入格式，之间仍需投影 / 渲染、画稿修整、分件与关节整理。若已有合格皮影画稿，可直接进入官方皮影工具 / Blender，不强制绕行三维生成。沿用现有 Studio 会员，不因新路线另行充值；本轮没有生成或消费积分。

### 官方插件与自有脚本的分工建议（2026-10-20）

用户表达更倾向直接用五天晴插件在 Blender 制作，询问方案优劣。当前建议正式人物优先尝试官方 WooooShadow 导入 / 装配与 Blender 修整，把项目自有脚本用于动作、统一材质、网页导出及资源预算；现有手工拼片悟空保留作运行对照。该建议不等于用户已确认最终生产格式，也不代表已安装或完成官方角色实跑。

已再次读取[作者工具站](https://piying.woooostudio.com/)及本机从官方取得的 [WooooShadow 0.8.13 包](https://piying.woooostudio.com/downloads/plugins/woop_importer-0.8.13.zip)中的 README 和代码声明。其功能是将 WOOP 分件纹理建成平面网格，按关节层级创建骨骼与刚性权重，并提供灯箱 / 合成预览。这与平面皮影方向一致；画稿、轮廓、关节动作仍需制作，导入插件不会自动从一张侧面图补出正背面或完整立体人体。若要上下移动显示正背面，需要多视角画稿 / 分件及动作适配；真实连续立体转身属于另一个制作选择。

[InkTool 作者商品页](https://wutianqing.gumroad.com/l/inktool)列出墨笔、描边、程序墨纹、墨影和宣纸背景，可优先用于场景 / 素材的水墨设计与 Blender 效果样稿。游戏端应验证烘焙纹理、可导出几何和骨骼或必要的着色器适配；不能把 Blender 灯箱、合成与程序节点效果直接当作 GLB 中已经保留。[Blender glTF 导出说明](https://docs.blender.org/manual/en/4.4/addons/import_export/scene_gltf2.html)描述的是对可识别节点的材质转换，不能据此承诺任意插件材质原样带入游戏。

下一步建议仅用一位原创悟空验证官方插件导入、Blender 行走 / 翻身制作与网页导出，并与现有样板在同地图、同镜头比较剪影、接缝、步态、转向、质感及下载成本；通过后再推广。不以开发完整通用插件平台作为前置，地图优先顺序继续保留。

以下章节保留旧工笔三维样板的制作输入和实际交付记录；其中完整人体、A 姿态与三维 LOD 要求不直接作为新皮影资源的默认制作规范。

## 山涧真实空间返工

2026-10-19 用户否定平地摆件式场景。本轮另生成自然岩壁（`80a7fa01-664f-45ad-bdfd-ef108bd95e84`）与完整树冠（`87c9fabd-3ed8-4916-a29d-9d8107a6ce1e`），各使用现有 Studio 积分 50，没有充值。原始源分别 15,227,600 / 14,033,972 字节，提示词、SHA-256 与运行清单在 `natural-canyon.json` / `natural-pine.json`。先前装饰性石崖 `ebba5268-8403-4561-b92c-fc03122bb8e1` 使用过 50 积分，但未达到自然山崖要求，现从近景构图撤出，源件保留，不能混作本轮自然岩壁。

岩壁在 Blender 统一水平长轴、焊接纹理接缝顶点后减至约 6,000 三角面，避免超大幅减面后裂缝；完整树冠先以 0.065 米体素重建体积、减面及重新展开 UV，再烘焙原始 Studio 颜色。运行树为 3,367 三角面 / 293,700 字节；从同一树冠提取的地被为 876 / 158,744。树叶仍是风格化阔叶，未按准确松针形制验收。新资源只替换当前西游近景，不改首页并行资产。

地面与水体采用原创连续网格；山脚按地形最低处埋入。树石静态阴影与环境遮蔽烘到地面 `COLOR_0`，检查防止导出器自动补白色通道导致烘焙失效。人物 / 特效和 Blender 共用地形表达式，细节与重建步骤见 [美术返工](xiyou-art-rework.md)。精细源与运行网格分离，所有需要建模的后续代表资源仍先走 Studio，再进行 Blender 和实机验收。

## 提示词与明确设置

提示词依次写对象、轮廓与文化特征、统一风格、便于加工的姿态、排除项。每项控制在约 500–750 英文字符；描述清楚的大色块、哑光材质、俯视可读轮廓和稳定结构，避免堆砌超精细、毛发、碎饰和 8K。

共同风格：`stylized Chinese gongbi illustrated 3D, broad clean hand-painted mineral colors, matte surfaces, readable silhouette in distant isometric camera`。角色明确 `neutral A pose, arms apart, feet separated, empty hands`，之后由 Blender 配骨架与道具。排除场景、底座、文字、飘散零件、皮肤毛孔、细毛与烘焙强阴影。实际结果仍可能违反排除项，必须清理：本轮狼妖生成了底座，已删除底座碎片并修正尾巴蒙皮后重新检查动作。

v3.1 的初始网格实际约 196–199 万三角面，贴图为 4K；不能直接导入网页，也不能把提示词里的低面数当成结果。Studio 三角面重拓扑明确填写角色 6,000、群怪 2,200、松岩 1,500、独立山石 1,000；再经 Blender 清理、缩至 1K / 512 贴图、导出 JPEG GLB，并以清单及真实 GLB 检查为准。P2 智能网格亦可优先试用，必须核查当次会员可用性、报价和实际质量。

## 本轮实际输入

唐僧（项目 `6a263182-2424-49bc-abb2-8cd67fb04185`）：

> Tang Sanzang, single Chinese Buddhist pilgrim, full body gongbi illustrated 3D game character. Calm face, shaved head, red kasaya, ivory robe, jade sash, antique gold edging, simple pilgrim crown. Broad clean hand-painted colors, matte cloth, readable distant isometric silhouette. Neutral A pose, empty hands, arms apart and feet apart, simple robe folds for animation. No pedestal, scenery, staff, text, tiny jewelry, dangling strips, pores, metallic skin or baked shadows. Low complexity browser game asset.

松岩（项目 `30cd4649-52ef-4130-b1eb-f80a2c61615b`）：

> A single modular Chinese shanshui scenery prop: one weathered vertical limestone rock with one elegant windswept pine growing from its top, exposed roots firmly gripping stone, three broad flat pine foliage clusters, blue-green mineral jade moss and warm grey stone, dark ink pine trunk. Stylized gongbi painted 3D diorama, matte broad color blocks, strong silhouette from elevated isometric camera. Simple economical solid geometry, no tiny needles, no floating leaves, no background, no pedestal, no mist, no water, no words. Browser game environment asset, final 512px texture and low triangle count.

水妖（项目 `c74414e7-0831-4597-a2e3-a09ba99a365e`）：

> Single small river demon from Journey to the West, original Chinese folktale game enemy. Stocky humanoid fish spirit, broad expressive fish face, two small cheek fins, short jade scales, ivory belly, simple indigo sleeveless cloth vest and dark waist sash. Empty hands with blunt webbed fingers, two short sturdy legs, no weapon. Stylized gongbi painted 3D, matte mineral blue-green colors with restrained antique gold accents. Strong readable silhouette at distant isometric camera. Neutral A pose, arms separated, feet separated, simple solid geometry for rigging. No scenery, pedestal, text, realistic skin, tiny jewelry, floating parts or baked shadows. Final web enemy target 2000 triangles and 512px texture.

狼妖（项目 `9f42d52d-6e8a-4d33-b52d-9bc155b31510`）：

> A single wolf demon mountain bandit from Journey to the West, biped Chinese folktale enemy. Expressive grey wolf head, pointed ears, strong short muzzle, dark eyebrow markings; upright athletic humanoid body, two arms, two legs and one thick tail. Simple dark jade cloth vest, faded vermilion waist sash, cloth trousers and bronze wrist guards. Broad clean gongbi hand-painted colors, matte surfaces, readable isometric game silhouette, slightly large head. Neutral A pose, arms and feet apart, empty paw hands. No weapon, scene, pedestal, text, fur strands, tiny ornaments or floating pieces. Web game enemy; final 2200 triangle and 512px texture budget.

独立山石（项目 `aa5ee5e0-2162-4ac1-88a3-a295938b3808`）：

> One solid ancient Chinese mountain boulder, an upright weathered limestone monolith with a broad stable base, rounded irregular asymmetric silhouette, tapering blunt top and a few large angular planes. Warm grey mineral stone, restrained dark ink creases and small muted jade moss patches. Stylized Chinese gongbi shanshui illustrated 3D game prop, matte hand-painted broad colors, simple strong readable silhouette from isometric camera. One continuous closed solid rock. No trees, branches, leaves, roots, grass, holes, cavities, floating pieces, pedestal, characters, inscriptions, scene, shiny metal or photoreal noisy detail. Final web prop target 1000 triangles, 512px texture.

本轮五次 v3.1 生成与五次三角减面，按界面报价共使用 275 个已有 Studio 积分；没有购买新套餐。共享账号还有其他并行制作，余额变动不全部归入本轮。

最终运行资产：唐僧 5,998 三角面 / 507,796 字节；水妖 2,200 / 260,248；狼妖 1,820 / 223,368；松岩 1,500 / 139,284；独立山石 996 / 71,352。每项一个绘制单元，三个新角色各 13 骨骼并包含待机、行走与施技。角色贴图最高 1K，群怪和环境为 512。精细源文件不随网页下载。

## 可重建交付

原始下载位于 `apps/xiyou/art/source/raw`，源文件哈希、项目 ID、可编辑源和实际预算记在运行资产清单。带签名的下载 URL 仅临时留在忽略目录，用后删除；不进入仓库或 Notion。

- `build_studio_party.py`：归正方向、缩图、清除生成残留、蒙皮，制作待机 / 行走 / 施技，再导出唐僧、水妖、狼妖与松岩。
- `build_seal_stone.py`：处理独立 Tripo 山石，用于五指山石、山口落石与可见道路边界。先前截取松岩的方案因断面和残枝不自然而弃用，不能把它当成最终资产。
- `build_portraits.py`：从最终游戏 GLB 渲染头像，选择和培养使用同一人物。
- `check_assets.py`：检查真实三角面、文件大小、贴图、材质绘制单元、骨骼、动画及权重。
- `check_wukong_motion.py -- --asset <name>`：重新导入运行 GLB，检查真实变形、脚底和完整动作，输出截图与数值。

常规地形重建必须保留已接收的 Studio 资源。悟空和白龙马继续使用此前已交付的 Studio 模型。龙形与部分地面、灯笼、路牌等仍有暂代资源，后续按同一标准继续替换；不标记为全项目最终美术认可。

## 群怪运行版本补充（2026-10-19）

普通狼妖和水妖沿用已有 Studio 项目与原始运行 GLB，使用 `apps/xiyou/art/build_crowd.py` 制作专用三维 LOD 和顶点动作纹理。先焊接接缝，再保护头脸、手脚和耳朵减面；不另生成程序占位，也不覆盖用于首领 / 编辑的原型骨骼。来源哈希、逐版本范围和误差记录在 `crowd-metadata.json`，可编辑 `source/crowd_lods.blend` 与 `assets/manifest.json` 一起交付。源模型变更后，资产检查会要求重烘焙。当前总下载 582,003 字节；运行方法、预算与实际怪海测试见 `xiyou-performance.md`。

## 现有 Studio 队伍动作返工（2026-10-19）

沿用唐僧、悟空、白龙马原始项目和网格，本次不新增 Studio 消费或 API 调用。`build_party_motion.py` 在既有可编辑源中重建五段动作，唐僧增加脚掌骨至 15 骨；运行清单保留原始来源 / 哈希并记录 `grounded-stride-v2` 与 `motion-profile.json`。旧 `build_spell_motion.py` 兼容入口也调用新流程。返工前源快照位于 `.local/qa/rigs-before/`，原始 Studio 输出保持原路径；正式重建始终保护原件。`check_party_motion.py` 重导入实际 GLB 验证形变与两脚 / 四蹄触地，继续由实际游戏镜头审阅自然度。场景复用已有 Studio 岩壁 / 山石 / 树冠，布置和占地改由共享 `world-layout.json` 管理，未把程序地形冒充新的 Tripo 模型。
