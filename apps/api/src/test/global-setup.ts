import { execFileSync } from "node:child_process";

export default function globalSetup(): void {
  execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    env: process.env,
    stdio: "inherit",
  });
}
