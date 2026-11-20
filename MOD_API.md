# Mod API v2

Market Simulator separates the **engine** from **game content**.

- The engine lives in `electron/` and `src/core/`. It owns the desktop host, rendering, save access, Mod discovery and content parsing.
- The required first-party content package lives in `mods/core/`. Game definitions and other non-engine content will be authored there, primarily as editable `.ini` files.
- Optional community packages live beside it in `mods/<mod-id>/`.

The core package is a normal data Mod with a reserved ID: `core`. It is loaded through the same validation pipeline as other packages, but the host exposes it separately as the authoritative base content source.

## Folder layout

```text
mods/
  core/
    manifest.json
    data/
      core.ini
  example-market/
    manifest.json
    data/
      market-events.json
```

The current `mods/core/data/core.ini` is only a structural placeholder. Actual game content is intentionally not migrated or authored as part of this infrastructure step.

## Install a Mod

1. Close the game.
2. Copy the Mod folder into `mods/`.
3. Ensure `manifest.json` is directly inside that folder.
4. Restart the game.

The game does not download Mods automatically. Only install packages from sources you trust.

## Manifest

API v2 manifests are JSON metadata files. Content files are declared explicitly:

```json
{
  "id": "example-market",
  "name": "Example Market Pack",
  "version": "1.0.0",
  "author": "Community",
  "description": "An example content package.",
  "apiVersion": 2,
  "iniFiles": ["market.ini"],
  "dataFiles": []
}
```

- `id`: required; must match the folder name.
- `name`, `version`, `author`: required display metadata.
- `description`: optional.
- `apiVersion`: must be `2`.
- `iniFiles`: optional list of INI files in `data/`.
- `dataFiles`: optional list of JSON files in `data/`, retained for structured legacy data and compatibility during the transition.

File names must be simple names, not paths. A file cannot be declared twice.

## INI content format

INI is the preferred format for editable game content. It supports sections, key/value pairs, comments, quoted strings, typed scalar values and inline JSON arrays/objects.

```ini
; Full-line comments start with ; or #
[market]
name = "North Atlantic Exchange"
starting_cash = 25000
allow_short_selling = false
description = A fictional market for a sample scenario
tickers = ["NOVA", "ORBT", "LUMA"]
```

Rules:

- Section headers use `[section-name]`.
- Assignments use `key = value`; spaces around the separator are ignored.
- Blank lines and lines beginning with `; ` or `#` are ignored.
- `true`, `false` and `null` become boolean/null values.
- Finite numeric literals become numbers.
- Double-quoted strings use JSON string escaping, e.g. `label = "Line one\\nLine two"`.
- Values beginning with `[` or `{` are parsed as JSON arrays/objects.
- Other unquoted values remain strings; commas are not implicitly treated as lists.
- Duplicate sections and duplicate keys in a section are errors.
- Keys named `__proto__`, `prototype` or `constructor` are rejected.

The parser does not execute code, expand environment variables, interpolate values or interpret inline comments. This keeps content predictable and safe to parse.

## Host API

The preload bridge exposes asynchronous methods:

- `window.gameHost.mods.list()`: Mod metadata and validation errors.
- `window.gameHost.mods.loadAll()`: all discovered packages with parsed data.
- `window.gameHost.content.loadCore()`: validates and returns the required core package plus the discovered package list.
- `window.gameHost.platform`: current operating-system platform.

The core result has `ok`, `core`, `mods` and, on failure, `error` fields. The parsed INI object is available under `core.data["core.ini"]` (and likewise for each declared INI file).

## Limits and compatibility

- API v2 is data-only. JavaScript Mods and runtime hooks are not enabled.
- Manifests are limited to 64 KiB.
- INI and JSON data files are limited to 2 MiB each.
- File names are limited to simple alphanumeric, underscore and hyphen names with the declared extension.
- Symbolic links are rejected for manifests, data directories and declared data files.
- A broken package is reported as an error and does not prevent other packages from being discovered.
- INI data is parsed as values and never executed as code.

API v1 manifests are not accepted by the v2 loader. Update a package's manifest to `apiVersion: 2` before using it with this engine version.
