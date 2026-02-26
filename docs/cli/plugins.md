---
summary: "CLI reference for `mtbot plugins` (list, install, enable/disable, doctor)"
read_when:
  - You want to install or manage in-process Gateway plugins
  - You want to debug plugin load failures
---

# `mtbot plugins`

Manage Gateway plugins/extensions (loaded in-process).

Related:

- Plugin system: [Plugins](/plugin)
- Plugin manifest + schema: [Plugin manifest](/plugins/manifest)
- Security hardening: [Security](/gateway/security)

## Commands

```bash
mtbot plugins list
mtbot plugins info <id>
mtbot plugins enable <id>
mtbot plugins disable <id>
mtbot plugins doctor
mtbot plugins update <id>
mtbot plugins update --all
```

Bundled plugins ship with MtBot but start disabled. Use `plugins enable` to
activate them.

All plugins must ship a `mtbot.plugin.json` file with an inline JSON Schema
(`configSchema`, even if empty). Missing/invalid manifests or schemas prevent
the plugin from loading and fail config validation.

### Install

```bash
mtbot plugins install <path-or-spec>
```

Security note: treat plugin installs like running code. Prefer pinned versions.

Supported archives: `.zip`, `.tgz`, `.tar.gz`, `.tar`.

Use `--link` to avoid copying a local directory (adds to `plugins.load.paths`):

```bash
mtbot plugins install -l ./my-plugin
```

### Update

```bash
mtbot plugins update <id>
mtbot plugins update --all
mtbot plugins update <id> --dry-run
```

Updates only apply to plugins installed from npm (tracked in `plugins.installs`).
