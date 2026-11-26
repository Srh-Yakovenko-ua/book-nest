import "reflect-metadata";
import { Controller, Get, type INestApplication } from "@nestjs/common";
import { ApiOkResponse, type OpenAPIObject } from "@nestjs/swagger";
import { Test } from "@nestjs/testing";
import { createZodDto } from "nestjs-zod";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { buildOpenApiDocument } from "./openapi.js";

const ProbeViewSchema = z.object({
  born: z.number().int().nullable(),
  name: z.string(),
  nickname: z.string().nullable(),
  tags: z.array(z.string()),
});

class NullableProbeDto extends createZodDto(ProbeViewSchema) {}

@Controller("api/openapi-probe")
class ProbeController {
  @ApiOkResponse({ type: NullableProbeDto })
  @Get()
  getProbe(): z.infer<typeof ProbeViewSchema> {
    return { born: null, name: "probe", nickname: null, tags: [] };
  }
}

let app: INestApplication;
let openApiDocument: OpenAPIObject;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ controllers: [ProbeController] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();
  openApiDocument = buildOpenApiDocument(app);
});

afterAll(async () => {
  await app.close();
});

function findArrayValuedTypes(node: unknown, path: string): string[] {
  if (Array.isArray(node)) {
    const items: unknown[] = node;
    return items.flatMap((item, index) => findArrayValuedTypes(item, `${path}[${index}]`));
  }
  if (!isRecord(node)) return [];
  const own = Array.isArray(node.type) ? [path] : [];
  const nested = Object.entries(node).flatMap(([key, value]) =>
    findArrayValuedTypes(value, `${path}.${key}`),
  );
  return [...own, ...nested];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function probeProperties(): Record<string, unknown> {
  const schema: unknown = openApiDocument.components?.schemas?.NullableProbeDto;
  if (!isRecord(schema) || !isRecord(schema.properties)) {
    throw new Error("components.schemas.NullableProbeDto has no properties");
  }
  return schema.properties;
}

describe("buildOpenApiDocument with nullable createZodDto fields", () => {
  it("declares an OpenAPI 3.0 document", () => {
    expect(openApiDocument.openapi).toMatch(/^3\.0\./);
  });

  it("emits a nullable string as a string with nullable true, not an array", () => {
    const { nickname } = probeProperties();

    expect(nickname).toMatchObject({ nullable: true, type: "string" });
    expect(nickname).not.toHaveProperty("items");
  });

  it("emits a nullable integer as an integer with nullable true, not an array", () => {
    const { born } = probeProperties();

    expect(born).toMatchObject({ nullable: true, type: "integer" });
    expect(born).not.toHaveProperty("items");
  });

  it("keeps a real string array as an array of strings", () => {
    const { tags } = probeProperties();

    expect(tags).toMatchObject({ items: { type: "string" }, type: "array" });
    expect(tags).not.toHaveProperty("nullable");
  });

  it("emits a non-nullable string without nullable", () => {
    const { name } = probeProperties();

    expect(name).toMatchObject({ type: "string" });
    expect(name).not.toHaveProperty("nullable");
    expect(name).not.toHaveProperty("items");
  });

  it("leaves no schema in the document with an array-valued type", () => {
    expect(findArrayValuedTypes(openApiDocument, "$")).toEqual([]);
  });
});
