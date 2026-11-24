import type { ShotsOptions } from "./shots-options.ts";

import { loginAndSaveSession } from "./shots-auth.ts";
import { parseShotsOptions, SHOTS_USAGE } from "./shots-options.ts";
import { runShots } from "./shots-run.ts";

const options = readOptions(process.argv.slice(2));

if (options !== null) {
  try {
    if (options.command === "login") {
      await loginAndSaveSession(options);
    } else {
      await runShots(options);
    }
  } catch (error) {
    process.stderr.write(`${errorMessage(error)}\n`);
    process.exitCode = 1;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function readOptions(argv: readonly string[]): null | ShotsOptions {
  try {
    return parseShotsOptions(argv);
  } catch (error) {
    process.stderr.write(`${SHOTS_USAGE}\n${errorMessage(error)}\n`);
    process.exitCode = 1;
    return null;
  }
}
