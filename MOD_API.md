# Mod API v3 — INI-only data packages

The engine owns executable behavior. Mods provide declarative INI data only. JSON Mod files and inline JSON values are forbidden. The root npm `package.json` is build metadata, not Mod data.

## Package layout

```text
mods/
  core/
    manifest.ini
    registry/
      registry.ini
      definitions.ini
    content/
      core.ini
      universe.ini
      economy.ini
      factions.ini
      military.ini
      events.ini
    localization/
      zh-CN.ini
  example-market/
    manifest.ini
    registry/
      definitions.ini
    content/
      market-events.ini
    localization/
      zh-CN.ini
```

Core is required and always enabled. Each package declares all files in its manifest. The loader reads only declared INI files and rejects JSON files in Mod categories.

## Manifest

```ini
[mod]
id = example-market
name = "Example Market"
version = 1.0.0
author = "Community"
description = "A data-only content package."
api_version = 3

[files]
registry = definitions.ini
content = market-events.ini
localization = zh-CN.ini
```

File lists are semicolon-separated; empty values mean no files in that category. Only simple `.ini` filenames are accepted.

## Registry

Each stable ID is a section suffix:

```ini
[entry.my-star-system]
type = star_system

[entry.my-colony]
type = colony
```

Supported types: `universe`, `star_system`, `location`, `trade_route`, `faction`, `colony`, `commodity`, `recipe`, `market`, `company`, `security`, `ship_class`, `fleet`, `war`, `event`.

## Content

Each entity uses `[type.stable-id]`; the singleton uses `[universe]`. Field names use snake_case. Scalar values are strings, finite numbers, booleans or null. Lists use semicolons. Repeated nested records use numbered keys.

```ini
[universe]
id = my-universe
start_date = 2478-04-01
default_player_faction_id = my-faction
default_market_id = my-market
name_key = entity.my-universe.name

[system.my-system]
position_x = 0
position_y = 1
links = second-system;third-system
location_ids = my-star;my-colony
faction_id = my-faction
name_key = entity.my-system.name

[colony.my-colony]
location_id = my-planet
faction_id = my-faction
population = 1250000
stability = 72
stockpile.ore = 140
stockpile.water = 80
industry.1 = mining-recipe:2:my-company
industry.2 = water-recipe:1:my-company

[recipe.mining-recipe]
input.1 = ore:2
output.1 = alloys:1.5
workforce = 180
name_key = entity.mining-recipe.name

[fleet.my-fleet]
faction_id = my-faction
location_id = my-planet
ship.1 = frigate:4
ship.2 = destroyer:1
```

Nested tuple fields:
- `stockpile.<commodity-id> = quantity`
- `industry.N = recipe-id:level:company-id` (`-` means no company)
- `input.N` / `output.N = commodity-id:quantity`
- `ship.N = ship-class-id:quantity`

## Localization

Player-visible strings belong in locale INI files. Definitions reference stable keys and never embed translated display text.

```ini
[language]
locale = zh-CN
display_name = "简体中文"

[content]
entity.my-universe.name = "我的星域"
entity.my-universe.description = "由多个星系组成的边境区域。"
```

Every entity needs `name_key`. Optional `description_key`, `government_key` and `unit_key` references must also resolve. Missing translations are catalog errors, not silently replaced with IDs.

## INI and safety rules

- UTF-8 text with `[section]` and `key = value`.
- Blank lines and lines beginning with `; ` or `#` are ignored.
- Quote strings containing delimiters or leading/trailing whitespace.
- Supported scalars: strings, finite numbers, `true`, `false`, `null`.
- Inline JSON arrays and objects are explicitly rejected.
- Maximum manifest size: 64 KiB; each INI file: 2 MiB.
- Duplicate sections and keys, unsafe keys, symlinks and path traversal are rejected.
- Executable scripts, native code, runtime hooks and code patches are unsupported.
