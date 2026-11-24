import type { Browser, Page } from "playwright";

import path from "node:path";

import type {
  AppScene,
  ShotLocale,
  ShotsManifest,
  ShotTargets,
  ShotViewportName,
} from "./shots-manifest.ts";
import type { RunOptions } from "./shots-options.ts";
import type { SceneInfo, ShotRecord } from "./shots-records.ts";

import { assertSessionSaved, assertSignedIn, saveSession, SessionError } from "./shots-auth.ts";
import {
  applyTheme,
  capture,
  type NetworkTracker,
  runSteps,
  settlePage,
  SHOT_VIEWPORTS,
  trackNetwork,
} from "./shots-page.ts";
import { errorSummary, shotFileName } from "./shots-records.ts";

type AppCapture = {
  browser: Browser;
  manifest: ShotsManifest;
  options: RunOptions;
  outDir: string;
};

type SceneRun = {
  locale: ShotLocale;
  network: NetworkTracker;
  page: Page;
  scene: AppScene;
  sceneInfo: SceneInfo;
  targets: ShotTargets;
  viewport: ShotViewportName;
};

const RATE_LIMIT = { attempts: 2, cooldownMs: 65_000 } as const;

const TARGET_PATTERN = /\{(\w+)\}/g;

export async function captureAppScenes({
  browser,
  manifest,
  options,
  outDir,
}: AppCapture): Promise<ShotRecord[]> {
  assertSessionSaved(options.statePath, options.baseUrl);
  const records: ShotRecord[] = [];
  let targets: null | ShotTargets = null;
  for (const viewport of options.viewports) {
    const context = await browser.newContext({
      ...SHOT_VIEWPORTS[viewport],
      reducedMotion: "reduce",
      storageState: options.statePath,
    });
    await context.addInitScript(() => {
      window.localStorage.setItem("theme", "system");
    });
    const page = await context.newPage();
    const network = trackNetwork(page);
    try {
      for (const locale of options.locales) {
        const open = (scenePath: string) => openPath({ locale, network, options, page, scenePath });
        targets ??= await manifest.discoverTargets({ open, page });
        let previousOpened = false;
        for (const [index, scene] of manifest.appScenes.entries()) {
          const sceneInfo = toSceneInfo(scene, index);
          if (scene.viewports !== undefined && !scene.viewports.includes(viewport)) {
            previousOpened = false;
            continue;
          }
          const run = { locale, network, page, scene, sceneInfo, targets, viewport };
          const sceneRecords = await captureScene(run, options, outDir, previousOpened);
          records.push(...sceneRecords);
          previousOpened = sceneRecords.every((record) => record.kind === "captured");
        }
      }
    } finally {
      await page.close();
      await saveSession(context, options.statePath);
      await context.close();
    }
  }
  return records;
}

async function captureScene(
  run: SceneRun,
  options: RunOptions,
  outDir: string,
  previousOpened: boolean,
): Promise<ShotRecord[]> {
  const { scene, sceneInfo, viewport } = run;
  const resolved = scene.path === undefined ? null : resolveTargets(scene.path, run.targets);
  if (resolved !== null && resolved.missing.length > 0) {
    return [
      skipped(
        sceneInfo,
        viewport,
        `на акаунті немає цілі зі статусом ${resolved.missing.join(", ")}`,
      ),
    ];
  }
  if (resolved === null && !previousOpened) {
    return [skipped(sceneInfo, viewport, "попередній екран не відкрився, тож цей теж пропущено")];
  }
  for (let attempt = 1; attempt <= RATE_LIMIT.attempts; attempt += 1) {
    const rateLimitedBefore = run.network.rateLimited();
    try {
      const records = await captureSceneOnce(
        run,
        options,
        outDir,
        resolved?.path ?? null,
        attempt > 1,
      );
      if (run.network.rateLimited() === rateLimitedBefore || attempt === RATE_LIMIT.attempts) {
        return records;
      }
    } catch (error) {
      if (error instanceof SessionError) throw error;
      if (attempt === RATE_LIMIT.attempts || run.network.rateLimited() === rateLimitedBefore) {
        return [skipped(sceneInfo, viewport, `не вдалося зняти: ${errorSummary(error)}`)];
      }
    }
    process.stdout.write("API answered 429, waiting a minute before retrying the scene.\n");
    await run.page.waitForTimeout(RATE_LIMIT.cooldownMs);
  }
  return [skipped(sceneInfo, viewport, "API обмежив кількість запитів (429)")];
}

async function captureSceneOnce(
  run: SceneRun,
  options: RunOptions,
  outDir: string,
  scenePath: null | string,
  isRetry: boolean,
): Promise<ShotRecord[]> {
  const { locale, network, page, scene, sceneInfo, viewport } = run;
  if (scenePath !== null) {
    await openPath({ locale, network, options, page, scenePath });
  } else if (isRetry) {
    await page.reload();
    assertSignedIn(page, options.baseUrl);
  }
  await runSteps(page, scene.steps ?? [], locale);
  const stepWarnings = await settlePage(page, network);
  const records: ShotRecord[] = [];
  for (const theme of options.themes) {
    const themeApplied = await applyTheme(page, theme);
    const warnings = [...stepWarnings, ...(await settlePage(page, network))];
    if (!themeApplied) warnings.push(`тема ${theme} не застосувалась`);
    const file = shotFileName({ locale, scene: sceneInfo, theme, viewport });
    warnings.push(...(await capture(page, path.join(outDir, file), scene.capture ?? "page")));
    records.push({
      file,
      kind: "captured",
      locale,
      scene: sceneInfo,
      theme,
      url: page.url(),
      viewport,
      warnings: [...new Set(warnings)],
    });
  }
  try {
    await runSteps(page, scene.cleanup ?? [], locale);
    return records;
  } catch (error) {
    const note = `після знімка не вдалося закрити: ${errorSummary(error)}`;
    return records.map((record) =>
      record.kind === "captured" ? { ...record, warnings: [...record.warnings, note] } : record,
    );
  }
}

async function openPath({
  locale,
  network,
  options,
  page,
  scenePath,
}: {
  locale: ShotLocale;
  network: NetworkTracker;
  options: RunOptions;
  page: Page;
  scenePath: string;
}): Promise<void> {
  await page.goto(new URL(`/${locale}${scenePath}`, options.baseUrl).href, {
    waitUntil: "domcontentloaded",
  });
  await settlePage(page, network);
  assertSignedIn(page, options.baseUrl);
}

function resolveTargets(
  scenePath: string,
  targets: ShotTargets,
): { missing: string[]; path: string } {
  const missing: string[] = [];
  const resolved = scenePath.replaceAll(TARGET_PATTERN, (match, name: string) => {
    const target = targets[name];
    if (target === undefined) {
      missing.push(name);
      return match;
    }
    return target;
  });
  return { missing, path: resolved };
}

function skipped(scene: SceneInfo, viewport: ShotViewportName, reason: string): ShotRecord {
  return { kind: "skipped", reason, scene, viewport };
}

function toSceneInfo(scene: AppScene, index: number): SceneInfo {
  return {
    description: scene.description,
    id: scene.id,
    order: index + 1,
    source: "app",
    title: scene.title,
  };
}
