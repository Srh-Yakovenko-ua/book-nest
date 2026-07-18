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

const PARAMETER_OBJECT_KEYS = new Set([
  "$ref",
  "allowEmptyValue",
  "allowReserved",
  "content",
  "deprecated",
  "description",
  "example",
  "examples",
  "explode",
  "in",
  "name",
  "required",
  "schema",
  "style",
]);

type UnknownRecord = Record<string, unknown>;

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

function hoistParameterSchemaKeywords(parameter: UnknownRecord): void {
  const leakedKeys = Object.keys(parameter).filter((key) => !PARAMETER_OBJECT_KEYS.has(key));
  if (leakedKeys.length === 0) {
    return;
  }

  const schema = isRecord(parameter.schema) ? parameter.schema : {};

  for (const key of leakedKeys) {
    const leakedValue = parameter[key];
    const existingValue = schema[key];

    if (existingValue === undefined) {
      schema[key] = leakedValue;
    } else if (Array.isArray(existingValue) && Array.isArray(leakedValue)) {
      schema[key] = [...existingValue, ...leakedValue];
    }

    delete parameter[key];
  }

  parameter.schema = schema;
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
          hoistParameterSchemaKeywords(parameter);
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
