import type { Browser } from "playwright";

import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { z } from "zod";

import type { ShotsManifest, StoryScene } from "./shots-manifest.ts";
import type { RunOptions } from "./shots-options.ts";
import type { SceneInfo, ShotRecord } from "./shots-records.ts";

import { capture, settlePage, SHOT_VIEWPORTS, trackNetwork } from "./shots-page.ts";
import { errorSummary, shotFileName } from "./shots-records.ts";

type RunningStorybook = { stop: () => void };

type StoryCapture = {
  browser: Browser;
  firstOrder: number;
  manifest: ShotsManifest;
  options: RunOptions;
  outDir: string;
};

const STORYBOOK = {
  firstLoadTimeoutMs: 180_000,
  locale: "uk",
  pollIntervalMs: 2000,
  readyTimeoutRounds: 120,
  rootSelector: "#storybook-root > *",
} as const;

const StoryIndexSchema = z.object({
  entries: z.record(z.string(), z.object({ id: z.string(), type: z.string() })),
});

const WEB_APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export async function captureStories({
  browser,
  firstOrder,
  manifest,
  options,
  outDir,
}: StoryCapture): Promise<ShotRecord[]> {
  if (manifest.stories.length === 0) return [];
  const storybook = await ensureStorybook(options.storybookUrl);
  try {
    const storyIds = await readStoryIds(options.storybookUrl);
    const records: ShotRecord[] = [];
    for (const viewport of options.viewports) {
      const context = await browser.newContext({
        ...SHOT_VIEWPORTS[viewport],
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      page.setDefaultTimeout(STORYBOOK.firstLoadTimeoutMs);
      const network = trackNetwork(page);
      try {
        for (const [index, story] of manifest.stories.entries()) {
          const scene = toSceneInfo(story, firstOrder + index);
          if (!storyIds.has(story.storyId)) {
            records.push({
              kind: "skipped",
              reason: `story ${story.storyId} не знайдено в Storybook`,
              scene,
              viewport,
            });
            continue;
          }
          for (const theme of options.themes) {
            const url = storyUrl(options.storybookUrl, story.storyId, theme);
            const file = shotFileName({ locale: STORYBOOK.locale, scene, theme, viewport });
            try {
              await page.goto(url.href, { waitUntil: "domcontentloaded" });
              await page.locator(STORYBOOK.rootSelector).first().waitFor();
              const warnings = await settlePage(page, network);
              warnings.push(...(await capture(page, path.join(outDir, file), "page")));
              records.push({
                file,
                kind: "captured",
                locale: STORYBOOK.locale,
                scene,
                theme,
                url: url.href,
                viewport,
                warnings,
              });
            } catch (error) {
              records.push({
                kind: "skipped",
                reason: `не вдалося зняти (${theme}): ${errorSummary(error)}`,
                scene,
                viewport,
              });
            }
          }
        }
      } finally {
        await context.close();
      }
    }
    return records;
  } finally {
    storybook.stop();
  }
}

async function ensureStorybook(storybookUrl: URL): Promise<RunningStorybook> {
  if (await isStorybookUp(storybookUrl)) {
    process.stdout.write(
      `Reusing the Storybook already running on ${storybookUrl.origin}; it is left running.\n`,
    );
    return { stop: () => undefined };
  }
  if (storybookUrl.port === "") {
    throw new Error(`The Storybook URL needs an explicit port: ${storybookUrl.href}`);
  }
  process.stdout.write(`Starting Storybook on ${storybookUrl.origin}...\n`);
  const child = spawn(`pnpm storybook --ci --port ${storybookUrl.port}`, {
    cwd: WEB_APP_DIR,
    detached: process.platform !== "win32",
    shell: true,
    stdio: "ignore",
  });
  let exitCode: null | number = null;
  child.once("exit", (code) => {
    exitCode = code ?? 1;
  });
  const stopOnInterrupt = () => {
    stopProcessTree(child);
    process.exit(130);
  };
  process.once("SIGINT", stopOnInterrupt);
  const stop = () => {
    process.off("SIGINT", stopOnInterrupt);
    stopProcessTree(child);
  };
  for (let round = 0; round < STORYBOOK.readyTimeoutRounds; round += 1) {
    await delay(STORYBOOK.pollIntervalMs);
    if (exitCode !== null) {
      stop();
      throw new Error(`Storybook exited with code ${String(exitCode)} before it was ready`);
    }
    if (await isStorybookUp(storybookUrl)) return { stop };
  }
  stop();
  throw new Error(`Storybook did not start on ${storybookUrl.origin}`);
}

async function isStorybookUp(storybookUrl: URL): Promise<boolean> {
  try {
    const response = await fetch(new URL("/index.json", storybookUrl));
    return response.ok;
  } catch {
    return false;
  }
}

async function readStoryIds(storybookUrl: URL): Promise<ReadonlySet<string>> {
  const response = await fetch(new URL("/index.json", storybookUrl));
  const index = StoryIndexSchema.parse(await response.json());
  return new Set(
    Object.values(index.entries)
      .filter((entry) => entry.type === "story")
      .map((entry) => entry.id),
  );
}

function stopProcessTree(child: ChildProcess): void {
  if (child.pid === undefined || child.exitCode !== null) return;
  const pid = child.pid;
  if (process.platform === "win32") {
    const result = spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore" });
    if (result.error !== undefined || result.status !== 0) {
      process.stderr.write(`Could not stop Storybook (pid ${String(pid)}); stop it by hand.\n`);
    }
    return;
  }
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    process.stderr.write(`Storybook (pid ${String(pid)}) was already gone.\n`);
  }
}

function storyUrl(storybookUrl: URL, storyId: string, theme: string): URL {
  const url = new URL("/iframe.html", storybookUrl);
  url.searchParams.set("id", storyId);
  url.searchParams.set("viewMode", "story");
  url.searchParams.set("globals", `theme:${theme}`);
  return url;
}

function toSceneInfo(story: StoryScene, order: number): SceneInfo {
  return {
    description: story.description,
    id: story.id,
    order,
    source: "storybook",
    title: story.title,
  };
}
