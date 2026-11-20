# Mods

This directory is reserved for development-time mods and examples.

The first mod format will be data-driven JSON. A mod should eventually contain a
manifest file describing its id, name, version, author, and content files.

Planned content types:
- Stocks and sectors
- Market events
- Market rules and balance configuration
- UI themes and sound presets

Executable JavaScript mods are intentionally postponed until a small, explicit
plugin API and permission boundary have been designed. Do not place untrusted
scripts here and assume they are safe to execute.
