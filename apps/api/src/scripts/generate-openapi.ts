import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { type OpenAPIObject } from "@nestjs/swagger";
import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { AppModule } from "../app.module.js";
import { buildOpenApiDocument } from "../core/openapi.js";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../../../..");
const outputPath = resolve(repoRoot, "openapi.json");

type UnknownRecord = Record<string, unknown>;

function foldParameterAllOf(parameter: UnknownRecord): void {
  const { allOf } = parameter;
  if (!Array.isArray(allOf)) {
    return;
  }

  delete parameter.allOf;

  const subschemas = allOf.filter(isRecord);
  if (subschemas.length === 0) {
    return;
  }

  const existingSchema = isRecord(parameter.schema) ? parameter.schema : {};
  const existingAllOf = Array.isArray(existingSchema.allOf) ? existingSchema.allOf : [];

  parameter.schema = {
    ...existingSchema,
    allOf: [...existingAllOf, ...subschemas],
  };
}

async function generateOpenApi(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  await app.init();

  const document = buildOpenApiDocument(app);
  normalizeParameters(document);
  normalizeExclusiveBounds(document);
  await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`, "utf8");

  await app.close();
  process.stdout.write(`openapi.json written to ${outputPath}\n`);
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeExclusiveBounds(node: unknown): void {
  if (Array.isArray(node)) {
    for (const item of node) {
      normalizeExclusiveBounds(item);
    }
    return;
  }

  if (!isRecord(node)) {
    return;
  }

  if (typeof node.exclusiveMinimum === "number") {
    node.minimum = node.exclusiveMinimum;
    node.exclusiveMinimum = true;
  }

  if (typeof node.exclusiveMaximum === "number") {
    node.maximum = node.exclusiveMaximum;
    node.exclusiveMaximum = true;
  }

  for (const value of Object.values(node)) {
    normalizeExclusiveBounds(value);
  }
}

function normalizeParameters(document: OpenAPIObject): void {
  const { paths } = document;

  for (const pathItem of Object.values(paths)) {
    if (!isRecord(pathItem)) {
      continue;
    }

    for (const operation of Object.values(pathItem)) {
      if (!isRecord(operation) || !Array.isArray(operation.parameters)) {
        continue;
      }

      for (const parameter of operation.parameters) {
        if (isRecord(parameter)) {
          foldParameterAllOf(parameter);
        }
      }
    }
  }
}

generateOpenApi()
  .then(() => {
    process.exit(0);
  })
  .catch((error: unknown) => {
    process.stderr.write(`${String(error)}\n`);
    process.exit(1);
  });
