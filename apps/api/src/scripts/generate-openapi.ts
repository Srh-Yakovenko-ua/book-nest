import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { AppModule } from "../app.module.js";
import { buildOpenApiDocument } from "../core/openapi.js";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../../../..");
const outputPath = resolve(repoRoot, "openapi.json");

async function generateOpenApi(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  await app.init();

  const document = buildOpenApiDocument(app);
  await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`, "utf8");

  await app.close();
  process.stdout.write(`openapi.json written to ${outputPath}\n`);
}

generateOpenApi()
  .then(() => {
    process.exit(0);
  })
  .catch((error: unknown) => {
    process.stderr.write(`${String(error)}\n`);
    process.exit(1);
  });
