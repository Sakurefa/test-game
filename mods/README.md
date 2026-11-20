# Mods

Mod packages are **INI-only**. Read [MOD_API.md](../MOD_API.md) for the format contract.

- `core/` is required and always enabled.
- Manifests, registry declarations, content definitions and localization all use INI.
- Content sections use `[type.stable-id]`; localized text is kept in locale INI files.
- JSON Mod files and inline JSON values are rejected.
- Mods are declarative data only; they cannot execute code.
