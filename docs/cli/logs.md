---
summary: "CLI reference for `mtbot logs` (tail gateway logs via RPC)"
read_when:
  - You need to tail Gateway logs remotely (without SSH)
  - You want JSON log lines for tooling
---

# `mtbot logs`

Tail Gateway file logs over RPC (works in remote mode).

Related:

- Logging overview: [Logging](/logging)

## Examples

```bash
mtbot logs
mtbot logs --follow
mtbot logs --json
mtbot logs --limit 500
```
