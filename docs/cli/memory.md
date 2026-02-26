---
summary: "CLI reference for `mtbot memory` (status/index/search)"
read_when:
  - You want to index or search semantic memory
  - You’re debugging memory availability or indexing
---

# `mtbot memory`

Manage semantic memory indexing and search.
Provided by the active memory plugin (default: `memory-core`; set `plugins.slots.memory = "none"` to disable).

Related:

- Memory concept: [Memory](/concepts/memory)
- Plugins: [Plugins](/plugins)

## Examples

```bash
mtbot memory status
mtbot memory status --deep
mtbot memory status --deep --index
mtbot memory status --deep --index --verbose
mtbot memory index
mtbot memory index --verbose
mtbot memory search "release checklist"
mtbot memory status --agent main
mtbot memory index --agent main --verbose
```

## Options

Common:

- `--agent <id>`: scope to a single agent (default: all configured agents).
- `--verbose`: emit detailed logs during probes and indexing.

Notes:

- `memory status --deep` probes vector + embedding availability.
- `memory status --deep --index` runs a reindex if the store is dirty.
- `memory index --verbose` prints per-phase details (provider, model, sources, batch activity).
- `memory status` includes any extra paths configured via `memorySearch.extraPaths`.
