import { execFileSync } from "node:child_process";
import path from "node:path";
import { parseArgs } from "node:util";
import { z } from "zod";

import type { ShotLocale, ShotTheme, ShotViewportName } from "./shots-manifest.ts";

export type LoginOptions = {
  baseUrl: URL;
  command: "login";
  statePath: string;
};

export type RunOptions = {
  baseUrl: URL;
  command: "run";
  feature: string;
  locales: readonly ShotLocale[];
  only: "all" | "app" | "storybook";
  outRoot: string;
  statePath: string;
  storybookUrl: URL;
  themes: readonly ShotTheme[];
  viewports: readonly ShotViewportName[];
};

export type ShotsOptions = LoginOptions | RunOptions;

const SHOTS_DEFAULTS = {
  baseUrl: "http://localhost:3000",
  only: "all",
  qaFolderName: "book-nest-qa",
  sessionFolderName: "shots",
  storybookUrl: "http://localhost:6006",
} as const;

const csvOf = <T extends string>(values: readonly [T, ...T[]]) =>
  z
    .string()
    .transform((raw) => raw.split(",").map((value) => value.trim()))
    .pipe(z.array(z.enum(values)).nonempty());

const ArgsSchema = z.object({
  base: z.url().default(SHOTS_DEFAULTS.baseUrl),
  locales: csvOf(["uk", "en"]).default(["uk"]),
  only: z.enum(["all", "app", "storybook"]).default(SHOTS_DEFAULTS.only),
  out: z.string().min(1).optional(),
  storybook: z.url().default(SHOTS_DEFAULTS.storybookUrl),
  themes: csvOf(["light", "dark"]).default(["light", "dark"]),
  viewports: csvOf(["desktop", "mobile"]).default(["desktop", "mobile"]),
});

const PositionalsSchema = z.tuple([z.string().min(1)]);

export const SHOTS_USAGE = [
  "Usage:",
  "  pnpm shots login [--base <url>]",
  "  pnpm shots <feature> [--base <url>] [--locales uk,en] [--viewports desktop,mobile]",
  "                       [--themes light,dark] [--only app|storybook] [--out <dir>] [--storybook <url>]",
].join("\n");

export function parseShotsOptions(argv: readonly string[]): ShotsOptions {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    args: [...argv],
    options: {
      base: { type: "string" },
      locales: { type: "string" },
      only: { type: "string" },
      out: { type: "string" },
      storybook: { type: "string" },
      themes: { type: "string" },
      viewports: { type: "string" },
    },
    strict: true,
  });
  const args = ArgsSchema.parse(values);
  const [command] = PositionalsSchema.parse(positionals);
  const baseUrl = new URL(args.base);
  const gitCommonDir = resolveGitCommonDir();
  const statePath = path.join(
    gitCommonDir,
    SHOTS_DEFAULTS.sessionFolderName,
    `${baseUrl.host.replaceAll(":", "-")}.json`,
  );
  if (command === "login") {
    return { baseUrl, command: "login", statePath };
  }
  return {
    baseUrl,
    command: "run",
    feature: command,
    locales: args.locales,
    only: args.only,
    outRoot:
      args.out ?? path.join(path.dirname(path.dirname(gitCommonDir)), SHOTS_DEFAULTS.qaFolderName),
    statePath,
    storybookUrl: new URL(args.storybook),
    themes: args.themes,
    viewports: args.viewports,
  };
}

function resolveGitCommonDir(): string {
  return execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], {
    encoding: "utf8",
  }).trim();
}
