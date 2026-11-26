import type { BrowserContextOptions, Page } from "playwright";

import type {
  ShotCapture,
  ShotLocale,
  ShotRole,
  ShotStep,
  ShotTheme,
  ShotViewportName,
} from "./shots-manifest.ts";

export type NetworkTracker = {
  inFlight: () => number;
  rateLimited: () => number;
  sequence: () => number;
};

const SETTLE = {
  busyTimeoutMs: 15_000,
  finalPauseMs: 400,
  maxQuietRounds: 40,
  quietWindowMs: 500,
  stepTimeoutMs: 10_000,
  themeTimeoutMs: 5000,
} as const;

const NETWORK = {
  rateLimitedStatus: 429,
  trackedResources: new Set(["document", "fetch", "font", "image", "script", "stylesheet", "xhr"]),
} as const;

const HIDDEN_OVERLAYS = {
  style: `${[
    "nextjs-portal",
    "[data-nextjs-toast]",
    "#react-scan-root",
    "html > canvas",
    "html > div",
    ".tsqd-parent-container",
  ].join(", ")} { display: none !important; }`,
} as const;

export const SHOT_VIEWPORTS: Readonly<Record<ShotViewportName, BrowserContextOptions>> = {
  desktop: { deviceScaleFactor: 1, viewport: { height: 900, width: 1280 } },
  mobile: {
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
    viewport: { height: 844, width: 390 },
  },
};

export async function applyTheme(page: Page, theme: ShotTheme): Promise<boolean> {
  await page.emulateMedia({ colorScheme: theme });
  try {
    await page.waitForFunction(
      (expectDark) => document.documentElement.classList.contains("dark") === expectDark,
      theme === "dark",
      { timeout: SETTLE.themeTimeoutMs },
    );
    return true;
  } catch {
    return false;
  }
}

export async function capture(page: Page, filePath: string, mode: ShotCapture): Promise<string[]> {
  const viewport = page.viewportSize();
  const documentHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  const stretch = mode === "page" && viewport !== null && documentHeight > viewport.height;
  if (stretch) {
    await page.setViewportSize({ height: documentHeight, width: viewport.width });
    await page.waitForTimeout(SETTLE.finalPauseMs);
  }
  const warnings = (await waitForImages(page)) ? [] : ["частина зображень не довантажилась"];
  try {
    await page.screenshot({
      animations: "disabled",
      caret: "hide",
      fullPage: mode === "page",
      path: filePath,
      style: HIDDEN_OVERLAYS.style,
    });
  } finally {
    if (stretch) await page.setViewportSize(viewport);
  }
  return warnings;
}

export async function runSteps(
  page: Page,
  steps: readonly ShotStep[],
  locale: ShotLocale,
): Promise<void> {
  for (const step of steps) {
    switch (step.kind) {
      case "click":
        await page
          .getByRole(step.role, {
            exact: typeof step.name[locale] === "string",
            name: step.name[locale],
          })
          .first()
          .click({ timeout: SETTLE.stepTimeoutMs });
        break;
      case "press":
        await page.keyboard.press(step.key);
        break;
      case "waitFor":
        await waitForRole(page, step.role);
        break;
    }
  }
}

export async function settlePage(page: Page, network: NetworkTracker): Promise<string[]> {
  const warnings: string[] = [];
  if (!(await waitForQuietNetwork(page, network))) {
    warnings.push("мережа не затихла, частина даних могла не довантажитись");
  }
  if (!(await waitForNoBusyRegions(page))) {
    warnings.push("на екрані лишився індикатор завантаження");
  }
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await page.waitForTimeout(SETTLE.finalPauseMs);
  return warnings;
}

export function trackNetwork(page: Page): NetworkTracker {
  let inFlight = 0;
  let sequence = 0;
  let rateLimited = 0;
  const isTracked = (resourceType: string) => NETWORK.trackedResources.has(resourceType);
  page.on("request", (request) => {
    if (!isTracked(request.resourceType())) return;
    inFlight += 1;
    sequence += 1;
  });
  const finish = (resourceType: string) => {
    if (!isTracked(resourceType)) return;
    inFlight = Math.max(0, inFlight - 1);
  };
  page.on("requestfinished", (request) => finish(request.resourceType()));
  page.on("requestfailed", (request) => finish(request.resourceType()));
  page.on("response", (response) => {
    if (response.status() === NETWORK.rateLimitedStatus) rateLimited += 1;
  });
  return {
    inFlight: () => inFlight,
    rateLimited: () => rateLimited,
    sequence: () => sequence,
  };
}

async function waitForImages(page: Page): Promise<boolean> {
  try {
    await page.waitForFunction(
      () => Array.from(document.images).every((image) => image.complete),
      undefined,
      { timeout: SETTLE.busyTimeoutMs },
    );
    return true;
  } catch {
    return false;
  }
}

async function waitForNoBusyRegions(page: Page): Promise<boolean> {
  try {
    await page.waitForFunction(
      () => document.querySelectorAll('[aria-busy="true"]').length === 0,
      undefined,
      { timeout: SETTLE.busyTimeoutMs },
    );
    return true;
  } catch {
    return false;
  }
}

async function waitForQuietNetwork(page: Page, network: NetworkTracker): Promise<boolean> {
  for (let round = 0; round < SETTLE.maxQuietRounds; round += 1) {
    const before = network.sequence();
    await page.waitForTimeout(SETTLE.quietWindowMs);
    if (network.inFlight() === 0 && network.sequence() === before) return true;
  }
  return false;
}

async function waitForRole(page: Page, role: ShotRole): Promise<void> {
  await page.getByRole(role).first().waitFor({ state: "visible", timeout: SETTLE.stepTimeoutMs });
}
