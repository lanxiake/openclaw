import type { Command } from "commander";

import { docsSearchCommand } from "./commands/docs.js";
import { defaultRuntime } from "../runtime.js";
import { formatDocsLink } from "../shared/terminal/links.js";
import { theme } from "../shared/terminal/theme.js";
import { runCommandWithRuntime } from "./cli-utils.js";

export function registerDocsCli(program: Command) {
  program
    .command("docs")
    .description("Search the live OpenClaw docs")
    .argument("[query...]", "Search query")
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("Docs:")} ${formatDocsLink("/cli/docs", "docs.openclaw.ai/cli/docs")}\n`,
    )
    .action(async (queryParts: string[]) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await docsSearchCommand(queryParts, defaultRuntime);
      });
    });
}
