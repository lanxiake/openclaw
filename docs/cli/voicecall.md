---
summary: "CLI reference for `mtbot voicecall` (voice-call plugin command surface)"
read_when:
  - You use the voice-call plugin and want the CLI entry points
  - You want quick examples for `voicecall call|continue|status|tail|expose`
---

# `mtbot voicecall`

`voicecall` is a plugin-provided command. It only appears if the voice-call plugin is installed and enabled.

Primary doc:

- Voice-call plugin: [Voice Call](/plugins/voice-call)

## Common commands

```bash
mtbot voicecall status --call-id <id>
mtbot voicecall call --to "+15555550123" --message "Hello" --mode notify
mtbot voicecall continue --call-id <id> --message "Any questions?"
mtbot voicecall end --call-id <id>
```

## Exposing webhooks (Tailscale)

```bash
mtbot voicecall expose --mode serve
mtbot voicecall expose --mode funnel
mtbot voicecall unexpose
```

Security note: only expose the webhook endpoint to networks you trust. Prefer Tailscale Serve over Funnel when possible.
