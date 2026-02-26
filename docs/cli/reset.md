---
summary: "CLI reference for `mtbot reset` (reset local state/config)"
read_when:
  - You want to wipe local state while keeping the CLI installed
  - You want a dry-run of what would be removed
---

# `mtbot reset`

Reset local config/state (keeps the CLI installed).

```bash
mtbot reset
mtbot reset --dry-run
mtbot reset --scope config+creds+sessions --yes --non-interactive
```
