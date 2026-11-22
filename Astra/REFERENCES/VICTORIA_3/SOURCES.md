# Victoria 3 参考资料来源登记

研究日期：2026-11-23

可信度标签：
- A — Paradox 官方：官方开发日志、官方产品资料。适合确认公开设计意图；早期日志需注意版本演进。
- B — 社区 Wiki / 版本核验：适合查机制细节；保留版本和页面状态。
- C — 社区数据解析/分析：适合观察游戏脚本定义、字段关系和可复现计算；不是官方源码。
- D — 社区指南/讨论：补充解释，需交叉核对。

## A — Paradox 官方资料

1. [Dev Diary #3 — Buildings（2021-06-10，Steam 公告镜像）](https://store.steampowered.com/news/posts/?enddate=1623341905&feed=steam_community_announcements) — 建筑作为人口工作地点；建筑需要合格人口；建设消耗劳动和商品。
2. [Dev Diary #5 — Production Methods（2021-06-24，Steam 公告镜像）](https://store.steampowered.com/news/posts/?enddate=1624550727&feed=steam_community_announcements) — 生产方式决定建筑功能、输入、输出和员工类型。
3. [Dev Diary #13 — Standard of Living（2021-09-02，Steam 公告镜像）](https://store.steampowered.com/news/posts/?enddate=1630599234&feed=steam_community_announcements) — 财富、生活水平、需求和消费的早期公开设计。
4. [Dev Diary #56 — Cultures and Religions（2022-08-24）](https://www.paradoxinteractive.com/games/victoria-3/news/dev-diary-56-cultures-and-religions) — Pop 文化/宗教属性与职业、工作地点、居住地的关系。
5. [Dev Diary #57 — The Journey So Far（2022-08-31）](https://www.paradoxinteractive.com/games/victoria-3/news/dev-diary-57-the-journey-so-far) — Pops、建筑、工资、所有者收入、消费需求和贸易路线设计演进。
6. [Dev Diary #59 — AI（2022-09-21）](https://www.paradoxinteractive.com/games/victoria-3/news/victoria-3-dev-diary-59-ai) — Spending Variables 预估在建/招聘建筑未来产生的 Buy/Sell Orders。
7. [Dev Diary #74 — UX Improvements](https://www.paradoxinteractive.com/games/victoria-3/news/dev-diary-74-ux-improvements) — 人口面板展示收入、消费和生活水平变化。
8. [Dev Diary #78 — Update 1.2 changelog](https://www.paradoxinteractive.com/games/victoria-3/news/dev-diary-78-update-1-2-changelog) — 贸易路线按市场价格交易、盈利条件调整。
9. [Dev Diary #131 — Famines, Starvation, Harvest Conditions（2024-10-10，Steam 公告镜像）](https://store.steampowered.com/news/posts/?enddate=1728568922&feed=steam_community_announcements) — 1.8 食物短缺、饥饿和 Food Security 的设计变化。
10. [Paradox Victoria 3 News index](https://www.paradoxinteractive.com/games/victoria-3/news) — 官方后续开发日志列表（本次可见列表至 2025-06 的 #149）。

## B — 社区 Wiki / 机制整理

1. [Pops](https://vic3.paradoxwikis.com/wiki/Pops) — Pop 组合属性和聚合粒度。
2. [Standard of living](https://vic3.paradoxwikis.com/wiki/Standard_of_living) — 标注 1.13 验证；财富、收入、消费包和需求关系。
3. [Needs](https://vic3.paradoxwikis.com/wiki/Needs) — 需求类别、可替代商品和权重。
4. [Production method](https://vic3.paradoxwikis.com/wiki/Production_method) — 标注 1.13 验证；生产方式组、输入/输出、劳动力与缩放。
5. [Pop modding](https://vic3.paradoxwikis.com/wiki/Pop_modding) — 职业定义、工资权重、资格和相关字段；部分内容标记为旧版本，需核验。

也参考 Wiki 内容的公开 GitHub 镜像 [maxzxc0110/Victoria3](https://github.com/maxzxc0110/Victoria3)，其中保留原始 Wiki URL、版本标签和抓取时间。镜像不是 Paradox 官方仓库。

## C — 社区数据解析与模型

1. [Victoria 3 Analysis — Parsed data](https://shabbygaybar.github.io/victoria3-analysis/showcase/parsed-data/) — 从安装的游戏数据解析建筑、商品、Pop needs、Pop types、Production Methods 等表。
2. [Victoria 3 Analysis — Economy reports](https://shabbygaybar.github.io/victoria3-analysis/data-dictionary/economy/) — 将建筑投入/产出、进出口、人口需求汇总为 Buy/Sell Orders，并展示 Market Report。
3. [Victoria 3 Analysis — Economy modeling](https://shabbygaybar.github.io/victoria3-analysis/guides/economy/) — 社区独立经济模型，适合理解数据流和做数值实验，不是官方公式规格。
4. [Victoria 3 Analysis — Repository structure](https://shabbygaybar.github.io/victoria3-analysis/project_structure/) — 解析器读取 buildings、goods、production_methods、buy_packages 等数据的位置。
5. [Vic3 Tabula — Needs](https://vic3tabula.com/en/needs) — 页面标注 Game 1.15.0，提取日期 2026-11-05；数值属于该版本快照。
6. [Vic3TimelineExtended — Vanilla Pops reference](https://github.com/jakeOmega/Vic3TimelineExtended/blob/main/docs/vanilla/vanilla_pops_reference.md) — 社区整理的 Pop 属性组合与聚合特征。
7. [Vic3TimelineExtended — Vanilla economy reference](https://github.com/jakeOmega/Vic3TimelineExtended/blob/main/docs/vanilla/vanilla_economy_reference.md) — 社区整理的工资、财富、需求和市场经济概念。

## 阅读与引用注意

- Dev Diary #3/#5/#13 是 2021 年初始设计说明，不是 2026 年版本完整规则。
- Wiki 文章标注 1.13，不代表自动适用于 1.15。
- Vic3 Tabula 1.15 页面是版本化数据快照；可用于查看结构和数值，不应未经核验照搬平衡。
- 社区解析项目通过游戏数据文件建模，无法证明所有隐藏运行时规则。
- 任何数值、阈值、公式都应先核对目标版本，再考虑是否适合本项目。
