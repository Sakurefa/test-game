# Victoria 3 商品经济、市场与价格

研究日期：2026-11-23

## 1. 市场的基本对象

Victoria 3 的市场围绕商品买卖订单（Buy Orders / Sell Orders）组织。供给和需求由多个来源共同形成：
- 建筑生产形成 Sell Orders。
- 建筑生产方法所需投入品形成 Buy Orders。
- Pops 的需求消费形成 Buy Orders。
- 进口形成 Sell Orders，出口形成 Buy Orders。
- 贸易中心和市场间贸易进一步改变订单和商品可用量。

社区经济解析项目的 Market Report 将建筑投入、建筑产出、进口、出口和人口需求拆开展示，并汇总为商品买卖订单。[Economy reports：Market report](https://shabbygaybar.github.io/victoria3-analysis/data-dictionary/economy/)

## 2. 价格与供需

Paradox 的公开设计强调供需会形成交易激励。Dev Diary #57 回顾了贸易系统从“玩家手工指定数量”转向“路线数量随利润扩张”的过程：玩家建立市场之间的路线，实际交易量由价差与盈利空间驱动，避免不断微调每条路线的运量。[Dev Diary #57](https://www.paradoxinteractive.com/games/victoria-3/news/dev-diary-57-the-journey-so-far)

市场价格与订单失衡关联。社区解析数据会记录：
- sell_orders：建筑产出与进口等卖单。
- buy_orders：建筑投入、出口、人口需求等买单。
- market_prices：当前市场价格。
- market_prices_variance：相对基础价格的变动。

不要将不同版本的价格上限、具体公式或弹性常数当成永恒规则；它们受版本、商品和市场配置影响。[Economy reports](https://shabbygaybar.github.io/victoria3-analysis/data-dictionary/economy/)；[Victoria 3 Analysis：经济模型](https://shabbygaybar.github.io/victoria3-analysis/guides/economy/)

## 3. 价格、人口与生产反馈环

典型反馈：
1. 建筑投入增加，抬高工具、钢材等商品的 Buy Orders。
2. 建筑产出增加，抬高对应商品的 Sell Orders。
3. 人口消费篮子形成持续需求；价格变化影响人口消费成本和财富变化。
4. 商品供需改变市场价格，进而影响建筑利润、工资支付能力与人口生活成本。
5. 生产方法、建筑扩张、人口财富变化又改变未来订单结构。

Paradox 的 Dev Diary #59 介绍 AI 的 Spending Variables：AI 预估在建/正在招聘建筑未来将增加多少买卖订单，以避免把当前短缺当成未来仍会持续的事实。这说明建设决策需要考虑建成后改变的供需，而不只是当前市场快照。[Dev Diary #59](https://www.paradoxinteractive.com/games/victoria-3/news/victoria-3-dev-diary-59-ai)

## 4. 贸易的设计取舍

Paradox 说明，最初的固定贸易量路线虽然简单，却要求玩家持续管理精确数量，也容易抽走他国关键商品或过度倾销。后来路线数量随盈利性调整，让玩家主要决定贸易方向、伙伴、关税/禁运，而不必逐条维护固定运输数量。[Dev Diary #57](https://www.paradoxinteractive.com/games/victoria-3/news/dev-diary-57-the-journey-so-far)

后续更新还调整了市场与贸易路线机制。例如 1.2 更新日志提到贸易路线按市场价格交易，并要求出口市场价格低于进口市场价格才可能盈利。[Dev Diary #78 / Update 1.2 changelog](https://www.paradoxinteractive.com/games/victoria-3/news/dev-diary-78-update-1-2-changelog)

这不意味着我们的游戏必须采用相同全球市场架构。星域、殖民地、航线和运输时间可以成为独立空间约束；但“价格差 + 运输成本 + 可运输量 + 风险”比玩家手工填写每次交易数量更适合长期自动化模拟。

## 5. 对本项目的启示

- 把商品流拆成可解释来源：生产、人口消费、工业投入、进出口/运输、库存变化。
- 价格可逐步从库存目标价转向可解释的订单供需价格；不要同时维护两套互相竞争的权威价格。
- 明确市场地理范围和库存归属：市场是汇总报价层，还是拥有库存/订单的交易场所？殖民地库存如何进入市场？星际运输何时改变库存？
- 交易量、价格和运输不能彼此脱节。未来贸易路线至少需要商品、起终市场、运量/能力、运输时间、成本和风险等语义，但不应提前建立通用贸易框架。
- 价格上涨不等于物理库存已耗尽；订单缺口、库存短缺、未满足需求和价格变化应分别记录。
