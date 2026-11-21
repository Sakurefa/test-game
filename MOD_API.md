## Registry

Registry declarations use INI section suffixes:

    [entry.my-star-system]
    type = star_system

    [entry.my-colony]
    type = colony

Supported content types currently include universe, star_system, location, trade_route, faction, colony, commodity, recipe, market, company, security, ship_class, fleet, war, event, profession and wealth_tier.

Population classification is defined on two independent axes. A profession describes an occupation; a wealth tier describes an economic position. A population group can later reference one of each, so the model does not need a hard-coded profession/wealth combination.

    [profession.miner]
    name_key = population.profession.miner.name

    [wealth_tier.low]
    name_key = population.wealth_tier.low.name

Core currently supplies only neutral `unassigned` and `unclassified` definitions reserved for the future cohort migration. They are not yet referenced by persisted population state and do not activate employment, wages, wealth, needs baskets or market settlement. Those mechanics must remain data-driven through Mod INI definitions when introduced.

## Content definitions

Each entity uses a [type.stable-id] section; the singleton universe uses [universe]. Field names use snake_case. Scalar values are strings, finite numbers, booleans or null. Lists use semicolons. Repeated nested records use numbered keys.

    [universe]
    id = my-universe
    start_date = 2478-04-01
    default_player_faction_id = my-faction
    name_key = entity.my-universe.name

    [colony.my-colony]
    location_id = my-planet
    faction_id = my-faction
    population = 1250000