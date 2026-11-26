import { format } from "date-fns";
import { existsSync, readdirSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

import type { RunOptions } from "./shots-options.ts";
import type { ShotRecord } from "./shots-records.ts";

import { SHOT_MANIFESTS } from "./manifests/index.ts";
import { captureAppScenes } from "./shots-app.ts";
import { writeShotsReport } from "./shots-report.ts";
import { captureStories } from "./shots-storybook.ts";

const OUTPUT = { folderName: "shots" } as const;

export async function runShots(options: RunOptions): Promise<void> {
  const manifest = SHOT_MANIFESTS[options.feature];
  if (manifest === undefined) {
    throw new Error(
      `Unknown feature "${options.feature}". Known: ${Object.keys(SHOT_MANIFESTS).join(", ")}`,
    );
  }
  const capturedAt = new Date();
  const outDir = await prepareOutDir(options.outRoot, manifest.feature, capturedAt);
  const browser = await chromium.launch();
  const records: ShotRecord[] = [];
  try {
    if (options.only !== "storybook") {
      records.push(...(await captureAppScenes({ browser, manifest, options, outDir })));
    }
    if (options.only !== "app") {
      const firstOrder = manifest.appScenes.length + 1;
      records.push(...(await captureStories({ browser, firstOrder, manifest, options, outDir })));
    }
  } finally {
    await browser.close();
    if (records.length > 0) {
      await writeShotsReport({ capturedAt, manifest, options, outDir, records });
    }
  }
  const captured = records.filter((record) => record.kind === "captured").length;
  const skipped = records.length - captured;
  process.stdout.write(
    `Captured ${String(captured)} screenshots, skipped ${String(skipped)}.\n${outDir}\n`,
  );
}

function isEmptyOrMissing(directory: string): boolean {
  return !existsSync(directory) || readdirSync(directory).length === 0;
}

async function prepareOutDir(outRoot: string, feature: string, capturedAt: Date): Promise<string> {
  const featureDir = path.join(outRoot, `${feature}-${format(capturedAt, "yyyy-MM-dd")}`);
  const preferred = path.join(featureDir, OUTPUT.folderName);
  const outDir = isEmptyOrMissing(preferred)
    ? preferred
    : path.join(featureDir, `${OUTPUT.folderName}-${format(capturedAt, "HHmm")}`);
  await mkdir(outDir, { recursive: true });
  return outDir;
}
