# Mod API v3 — Data-only packages

The engine owns all executable behavior. Mods provide declarative data only.

**A Mod cannot ship or execute JavaScript, scripts, native binaries, runtime hooks or code patches.** If a game mechanic needs to change, the engine itself must be changed by the project maintainers. A future extension API, if ever needed, will be designed separately with explicit capabilities and permissions.

## Package layout

```text
mods/
  core/
    manifest.json
    registry/
      registry.ini
      definitions.json
    content/
      core.ini
      universe.json
      economy.json
      factions.json
      military.json
      events.json
    localization/
      zh-CN.ini
  example-market/
    manifest.json
    registry/
      definitions.json
    content/
      market-events.json
```

Every package has a `manifest.json`. The three data categories have distinct responsibilities:

- `registry/`: declares stable IDs and their definition types.
- `content/`: stores actual definitions and values.
- `localization/`: maps stable text keys to language-specific strings. Display names and descriptions never belong in content definitions.

The reserved `core` package is required and always enabled. It defines the initial universe, systems, locations, colonies, trade routes, factions, commodities, production recipes, markets, companies, securities, ship classes, fleets, wars and event definitions.

## Manifest

All three category arrays are required, even when empty:

```json
{
  "id": "example-pack",
  "name": "Example Pack",
  "version": "1.0.0",
  "author": "Community",
  "description": "A data-only content package.",
  "apiVersion": 3,
  "registryFiles": ["definitions.json"],
  "contentFiles": ["new-content.json"],
  "localizationFiles": []
}
```

Declared filenames must be simple filenames in their category directory. Path separators and parent traversal are not allowed. Supported files are `.ini` and `.json`.

## Registry and definition types

A registry JSON file contains a top-level `entries` array:

```json
{
  "schemaVersion": 1,
  "entries": [
    { "id": "my-star-system", "type": "star_system" },
    { "id": "my-colony", "type": "colony" }
  ]
}
```

The ID in the registry must match exactly one content definition. IDs are globally unique across enabled packages. Supported types are `universe`, `star_system`, `location`, `trade_route`, `faction`, `colony`, `commodity`, `recipe`, `market`, `company`, `security`, `ship_class`, `fleet`, `war` and `event`.

Content JSON files use top-level collections such as `systems`, `locations`, `colonies`, `commodities`, `recipes`, `markets`, `companies`, `securities`, `shipClasses`, `fleets`, `wars` and `events`. A universe file also contains one `universe` object and may contain `tradeRoutes`.

The loader validates duplicate IDs and cross-references before the world is allowed to start. For example, a colony must reference a valid location and faction, each industry must reference a valid recipe, and recipe inputs and outputs must reference valid commodities.

## INI format

INI remains available for human-editable settings and small data groups:

```ini
[market]
name = "North Exchange"
starting_cash = 25000
allow_short_selling = false
tickers = ["NOVA", "ORBT", "LUMA"]
```

- Section headers use `[section-name]`.
- Assignments use `key = value`.
- `true`, `false` and `null` become boolean/null values.
- Finite numeric literals become numbers.
- Double-quoted strings use JSON escaping.
- Values beginning with `[` or `{` are parsed as JSON.
- Other unquoted values remain strings.
- Duplicate sections and duplicate keys are errors.
- Dangerous object keys such as `__proto__`, `prototype` and `constructor` are rejected.

INI is a data format, not a programming language. Values are parsed and validated; they are never evaluated as code.

## Safety limits

- Manifests: 64 KiB maximum.
- Each INI file: 2 MiB maximum.
- Each JSON file: 2 MiB maximum.
- Symlinks are rejected for manifests, category directories and declared files.
- A malformed package is reported independently and does not hide other packages.
- Unknown API versions are rejected.

No compatibility path for executable Mod code exists. See [docs/ENGINE_ARCHITECTURE.md](docs/ENGINE_ARCHITECTURE.md) for how data enters the simulation engine.

## Localization contract

Every content entity must define a stable `nameKey`; optional player-facing descriptions and faction government labels use `descriptionKey` and `governmentKey`. The content definition stores only these keys, never localized display strings.

A locale file declares its locale and provides a `[content]` section. Keys are namespaced by entity ID so they remain stable across languages:

```ini
[language]
locale = zh-CN
display_name = "简体中文"

[content]
entity.solace.name = "澄光星系"
entity.solace.description = "边境贸易与矿业交通的交汇处。"
entity.helios-compact.name = "赫利俄斯协约"
entity.helios-compact.government = "联合议会"
```

Use the same keys in other locale files (for example `en-US.ini`) with translated values. The catalog compiler validates every referenced key for the default locale before a world can start. Missing strings are content errors, not silently replaced with IDs. The renderer receives the selected localization dictionary and resolves names at display time.

Do not put translated names in registry IDs, content IDs, save-state identifiers, or simulation rules. IDs are permanent machine-facing identifiers; localized strings are presentation data.
