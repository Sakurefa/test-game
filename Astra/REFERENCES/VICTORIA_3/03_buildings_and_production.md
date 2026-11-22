# Victoria 3 建筑、就业与生产方式

研究日期：2026-11-23

## 1. 建筑是什么

Paradox 在 Dev Diary #3 将建筑描述为人口工作的地点和生产/服务单位，而不一定是单栋物理建筑。建筑需要合格 Pops 入职才产生相应收益；没有员工的建筑没有生产价值。建筑建设本身也会消耗人口劳动和商品。[Dev Diary #3（Steam 公告镜像）](https://store.steampowered.com/news/posts/?enddate=1623341905&feed=steam_community_announcements)

这使建筑成为人口、商品和货币之间的连接点，而不只是一个“每周增加 N 单位商品”的静态按钮。

## 2. 生产方式（Production Methods）

Paradox 的 Dev Diary #5 说明，Production Methods 决定建筑的功能、投入商品、产出商品，以及运行所需员工类型。技术进步并非单纯提高产量：新方法可能需要更稀缺的投入品，也可能改变产品结构或岗位构成。[Dev Diary #5（Steam 公告镜像）](https://store.steampowered.com/news/posts/?enddate=1624550727&feed=steam_community_announcements)

社区 Wiki 对 1.13 版本的归纳进一步说明：
- 一个建筑有一个或多个 Production Method Group。
- 每个 Group 在同一建筑配置中选择一个启用的方法。
- Base 方法通常决定主要投入/产出和基础劳动力。
- Secondary 方法可增加副产品，同时减少主产品或增加额外投入。
- Automation 方法可能减少某类劳动力，但增加机器/燃料等投入。
- 方法可受科技、法律、资源或其他方法的解锁条件约束。
- 就业、投入和产出可按建筑等级、实际雇佣比例或吞吐量缩放。

这些是版本化游戏数据和 Wiki 对机制的整理，不是引擎源码。[Production method（标注 1.13）](https://vic3.paradoxwikis.com/wiki/Production_method)

## 3. 就业与资格

生产方式定义岗位需求，建筑再从当地 Pops 中招聘对应职业。能否招聘不只取决于人口总量，还取决于目标职业资格、当地可用人口、工资吸引力、建筑盈利情况，以及当前方法需要的岗位数量。

Wiki 与社区数据解析可看到职业定义中的工资权重、资格、失业属性、消费倍率等字段；生产方法解析则把每个方法对应的职业就业数量与商品流整理出来。[Pop modding](https://vic3.paradoxwikis.com/wiki/Pop_modding)；[Parsed data：Population types / Production methods](https://shabbygaybar.github.io/victoria3-analysis/showcase/parsed-data/)

## 4. 工资、利润与人口反馈

建筑购买投入商品、销售产出商品，支付工资并可能产生利润。工资进入劳动人口收入；所有者收益可形成分红和再投资/消费。由此，生产扩张既改变商品供需，也改变人口收入与需求。

如果我们的游戏未来要实现“建筑实际 workforce + 工资”，就必须有权威的雇佣人数和来源人口群体记录。仅有配方中的 workforce 数字，不足以说明这些人从哪里来、属于什么群体、工资给谁、失业时如何处理。

## 5. 对本项目的启示

- 将配方商品流和建筑就业需求分开表达；“生产配方需要 120 劳动力”不等于“已经雇佣 120 人”。
- 先建立实际雇佣群体与人数，再做工资、失业、资格或建筑条件效果。
- 生产方式可以是未来 Mod 内容配置：一个建筑有可选模式，每个模式定义输入、输出、岗位与解锁条件；Engine 只提供通用读取、校验和结算。
- 自动化应有代价：少用劳动力可能增加工具、能源或资本品投入；不要把升级设计成所有维度无代价提升。
- 现阶段继续沿用简单 recipe 生产即可；不要为了模仿 V3 提前建设完整 PMG / qualification / hiring 框架。
