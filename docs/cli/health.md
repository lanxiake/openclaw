---
summary: "CLI reference for `mtbot health` (gateway health endpoint via RPC)"
read_when:
  - You want to quickly check the running Gateway’s health
---

# `mtbot health`

Fetch health from the running Gateway.

```bash
mtbot health
mtbot health --json
mtbot health --verbose
```

Notes:

- `--verbose` runs live probes and prints per-account timings when multiple accounts are configured.
- Output includes per-agent session stores when multiple agents are configured.
