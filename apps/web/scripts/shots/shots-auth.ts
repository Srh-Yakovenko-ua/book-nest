import type { BrowserContext, Page } from "playwright";

import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

import type { LoginOptions } from "./shots-options.ts";

const AUTH = {
  loginPath: "/uk/login",
  loginTimeoutMs: 600_000,
  pathPattern:
    /^\/(?:uk|en)\/(?:login|register|forgot-password|reset-password|verify-email|resend-verification)(?:\/|$)/,
} as const;

export class SessionError extends Error {}

export function assertSessionSaved(statePath: string, baseUrl: URL): void {
  if (existsSync(statePath)) return;
  throw new SessionError(
    `No saved session for ${baseUrl.host}. Run first: pnpm shots login --base ${baseUrl.origin}`,
  );
}

export function assertSignedIn(page: Page, baseUrl: URL): void {
  if (!isAuthPath(new URL(page.url()))) return;
  throw new SessionError(
    `The saved session for ${baseUrl.host} no longer works. Run: pnpm shots login --base ${baseUrl.origin}`,
  );
}

export function isAuthPath(url: URL): boolean {
  return AUTH.pathPattern.test(url.pathname);
}

export async function loginAndSaveSession(options: LoginOptions): Promise<void> {
  const browser = await chromium.launch({ headless: false });
  try {
    const context = await browser.newContext({ viewport: null });
    const page = await context.newPage();
    await page.goto(new URL(AUTH.loginPath, options.baseUrl).href);
    process.stdout.write(
      `Log in to ${options.baseUrl.origin} in the browser window that just opened. Waiting up to 10 minutes.\n`,
    );
    await page.waitForURL((url) => url.origin === options.baseUrl.origin && !isAuthPath(url), {
      timeout: AUTH.loginTimeoutMs,
    });
    await page.waitForLoadState("networkidle");
    await saveSession(context, options.statePath);
    process.stdout.write(`Session saved for ${options.baseUrl.host}.\n`);
  } finally {
    await browser.close();
  }
}

export async function saveSession(context: BrowserContext, statePath: string): Promise<void> {
  await mkdir(path.dirname(statePath), { recursive: true });
  await context.storageState({ path: statePath });
}
