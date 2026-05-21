#!/usr/bin/env node
import { Command } from "commander";
import { initWailsReleaseKit } from "./index.js";

const program = new Command()
  .name("wails-release-kit")
  .description("Scaffold Wails desktop GitHub release automation.");

program
  .command("init")
  .description("write workflow, installer, and helper scripts into a Wails project")
  .requiredOption("--app <name>", "application display name")
  .requiredOption("--binary <name>", "binary name without extension")
  .option("--repo <owner/repo>", "GitHub repo used in download docs")
  .option("--cwd <path>", "project directory", process.cwd())
  .option("--main-branch <branch>", "main release branch", "main")
  .action(async (options) => {
    const result = await initWailsReleaseKit({
      cwd: options.cwd,
      app: options.app,
      binary: options.binary,
      repo: options.repo,
      mainBranch: options.mainBranch,
    });
    for (const file of result.files) console.log(file);
  });

await program.parseAsync();
