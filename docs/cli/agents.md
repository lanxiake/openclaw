---
summary: "CLI reference for `mtbot agents` (list/add/delete/set identity)"
read_when:
  - You want multiple isolated agents (workspaces + routing + auth)
---

# `mtbot agents`

Manage isolated agents (workspaces + auth + routing).

Related:

- Multi-agent routing: [Multi-Agent Routing](/concepts/multi-agent)
- Agent workspace: [Agent workspace](/concepts/agent-workspace)

## Examples

```bash
mtbot agents list
mtbot agents add work --workspace ~/.mtbot/workspace-work
mtbot agents set-identity --workspace ~/.mtbot/workspace --from-identity
mtbot agents set-identity --agent main --avatar avatars/mtbot.png
mtbot agents delete work
```

## Identity files

Each agent workspace can include an `IDENTITY.md` at the workspace root:

- Example path: `~/.mtbot/workspace/IDENTITY.md`
- `set-identity --from-identity` reads from the workspace root (or an explicit `--identity-file`)

Avatar paths resolve relative to the workspace root.

## Set identity

`set-identity` writes fields into `agents.list[].identity`:

- `name`
- `theme`
- `emoji`
- `avatar` (workspace-relative path, http(s) URL, or data URI)

Load from `IDENTITY.md`:

```bash
mtbot agents set-identity --workspace ~/.mtbot/workspace --from-identity
```

Override fields explicitly:

```bash
mtbot agents set-identity --agent main --name "MtBot" --emoji "🦞" --avatar avatars/mtbot.png
```

Config sample:

```json5
{
  agents: {
    list: [
      {
        id: "main",
        identity: {
          name: "MtBot",
          theme: "space lobster",
          emoji: "🦞",
          avatar: "avatars/mtbot.png",
        },
      },
    ],
  },
}
```
