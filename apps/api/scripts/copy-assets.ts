import { cp } from "node:fs/promises";

const assetDirs = ["modules/mail/assets"];

async function copyAssets(): Promise<void> {
  for (const dir of assetDirs) {
    const source = new URL(`../src/${dir}/`, import.meta.url);
    const destination = new URL(`../dist/${dir}/`, import.meta.url);
    await cp(source, destination, { recursive: true });
  }
}

await copyAssets();
