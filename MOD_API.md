# Mod API v1

Market Simulator currently supports **data-only Mods**. A Mod is a folder inside the repository's root `mods/` directory.

## Install

1. Close the game.
2. Copy a Mod folder into `mods/`.
3. Make sure its `manifest.json` is directly inside that folder.
4. Start the game again.

The game never downloads Mods automatically. Only install Mods from sources you trust.

## Folder layout

```text
mods/
  example-market/
    manifest.json
    data/
      market-events.json
```

## Manifest

```json
{
  "id": "example-market",
  "name": "Example Market Pack",
  "version": "1.0.0",
  "author": "Community",
  "description": "A small example data pack.",
  "apiVersion": 1,
  "dataFiles": ["market-events.json"]
}
```

Fields:
- `id`: required, unique folder identifier; lowercase letters, digits, dot, underscore and hyphen.
- `name`, `version`, `author`: required display metadata.
- `description`: optional description.
- `apiVersion`: must be `1`.
- `dataFiles`: JSON filenames located under the Mod's `data/` directory.

## Host API

The preload bridge exposes these methods to the game renderer:

- `window.gameHost.mods.list()`: returns Mod metadata and validation errors.
- `window.gameHost.mods.loadAll()`: returns metadata plus each Mod's parsed JSON data.
- `window.gameHost.platform`: current operating-system platform.

These methods are asynchronous and return Promises. A Mod is not currently executed as JavaScript. The current title screen does not yet consume Mod data; this release establishes the external folder, manifest validation and host bridge for future game systems.

## Limits and compatibility

- API version 1 is data-only.
- Each manifest is limited to 64 KiB.
- Each JSON data file is limited to 2 MiB.
- Data filenames must be simple `.json` filenames; paths and parent-directory traversal are rejected.
- A Mod with an invalid manifest, unsupported API version, missing file or invalid JSON is reported with an error and does not prevent other Mods from being discovered.
- Place only trusted content in your Mods folder. Data files are parsed as JSON and are not executed as code.

## Future compatibility

New content types will be introduced through documented JSON schemas and versioned API changes. JavaScript plugins, permissions and runtime hooks are not part of API v1.
