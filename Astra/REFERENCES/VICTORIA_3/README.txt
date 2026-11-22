Victoria 3 — Reference Collection
===================================

Research snapshot: 2026-11-23
Purpose: inform the design of our aggregate population, production and economic
simulation. This is comparative reference material, not a plan to reproduce V3.

READING ORDER
-------------
1. 04_our_game_mapping.md — most useful for our project.
2. 01_population_and_needs.md — Pops, wealth, needs and consumption.
3. 02_economy_and_markets.md — goods, orders, prices and trade.
4. 03_buildings_and_production.md — buildings, employment and production methods.
5. SOURCES.md — source register, confidence and version notes.

CORE FINDINGS
-------------
- Victoria 3 treats population as the economic foundation. Pops have concrete
  identity/location/work attributes; their income and needs feed demand back
  into the market.
- A Pop's wealth determines which buy-package/need basket it can afford. Needs
  are categories that can be fulfilled by multiple substitutable goods.
- Buildings are workplaces and production units. Production methods define
  input goods, output goods and jobs required. Employment, wages and profitability
  connect production back to population.
- Goods markets aggregate buy and sell orders from buildings, Pops and trade.
  Price responds to market balance. Trade routes are designed to respond to
  profitable price differences rather than manual shipment quantities.
- Official diaries explain public design intent; they do not reveal the complete
  proprietary engine implementation. Community parsers expose script data and
  analytical models, not the private runtime.

VERSION / CONFIDENCE
--------------------
- Official diaries are authoritative for what Paradox publicly said at the time,
  but older diaries describe earlier versions.
- Wiki pages used here identify some mechanics as verified against version 1.13.
- Victoria 3 Analysis is a community parser/model, not an official spec.
- Vic3 Tabula reports a 1.15.0 extraction dated 2026-11-05. Values are snapshots.
- Do not copy version-specific values or formulas without checking the target build.

PROJECT GUARDRAILS
------------------
- Our population dimensions are independent marginals, not V3's fully specified
  Pop combinations. Never multiply profession, wealth or other marginal shares
  to invent a joint population distribution.
- A group's need profile must be explicitly assigned or grounded in authoritative
  data. Do not infer a profession/wealth household from independent dimensions.
- Engine stays generic. Goods, needs, baskets, production methods and balancing
  values belong in Mod INI.
- Add market, affordability and workforce rules only after state ownership,
  cadence, allocation and transaction boundaries are clear.
