# Mod API v3 — Data-only packages

Market Simulator separates the engine from game content. The engine owns all executable behavior. Mods provide declarative data only.

**A Mod cannot ship or execute JavaScript, scripts, native binaries, runtime hooks or code patches.** If a game mechanic needs to change, the engine itself must be changed by the project maintainers. A future extension API, if ever needed, will be designed separately with explicit capabilities and permissions.

## Package layout

```text
mods/
  core/
    manifest.json
    registry/
      registry.ini
    content/
      core.ini
    localization/
      zh-CN.ini
  example-market/
    manifest.json
    content/
      market-events.json
```

Every package has a `manifest.json`. The three data categories have distinct responsibilities:

- `registry/`: declares IDs, types, ownership and references so the engine can discover content.
- `content/`: stores the actual game definitions and values.
- `localization/`: maps stable text keys to language-specific strings.

The reserved `core` package is required and always enabled. Its contents establish the base game data. The current files are structural placeholders; actual gameplay content will be authored separately.

## Manifest

All three category arrays are required, even when empty:

```json
{
  "id": "example-market",
  "name": "Example Market Pack",
  "version": "1.0.0",
  "author": "Community",
  "description": "An example content package.",
  "apiVersion": 3,
  "registryFiles": [],
  "contentFiles": ["market-events.json"],
  "localizationFiles": []
}
```

File declarations are simple filenames located directly inside their matching category directory. Path separators and parent traversal are not allowed. Supported files are `.ini` and `.json`. Duplicate declarations are rejected.

## INI format

INI is the preferred human-editable format. It supports sections, key/value pairs, full-line comments, quoted strings, typed scalar values and inline JSON arrays/objects.

```ini
; Full-line comments start with ; or #
[market]
name = "North Atlantic Exchange"
starting_cash = 25000
allow_short_selling = false
description = A fictional market for a sample scenario
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

INI is a data format, not a programming language. Values are parsed, validated and passed to engine-owned systems; they are never evaluated as code.

## Safety limits

- Manifests: 64 KiB maximum.
- Each INI file: 2 MiB maximum.
- Each JSON file: 2 MiB maximum.
- Symlinks are rejected for manifests, category directories and declared files.
- A malformed package is reported independently and does not hide other packages.
- Unknown API versions are rejected.

API v1 and v2 packages must be migrated to the v3 category layout. No compatibility path for executable Mod code exists.

## Host API

The preload bridge exposes:

- `window.gameHost.mods.list()`: package metadata and validation errors.
- `window.gameHost.mods.loadAll()`: discovered packages with parsed category data.
- `window.gameHost.content.loadCore()`: validates and returns the required core package.
- `window.gameHost.platform`: current operating-system platform.
