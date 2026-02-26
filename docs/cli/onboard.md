---
summary: "CLI reference for `mtbot onboard` (interactive onboarding wizard)"
read_when:
  - You want guided setup for gateway, workspace, auth, channels, and skills
---

# `mtbot onboard`

Interactive onboarding wizard (local or remote Gateway setup).

Related:

- Wizard guide: [Onboarding](/start/onboarding)

## Examples

```bash
mtbot onboard
mtbot onboard --flow quickstart
mtbot onboard --flow manual
mtbot onboard --mode remote --remote-url ws://gateway-host:18789
```

Flow notes:

- `quickstart`: minimal prompts, auto-generates a gateway token.
- `manual`: full prompts for port/bind/auth (alias of `advanced`).
- Fastest first chat: `mtbot dashboard` (Control UI, no channel setup).
