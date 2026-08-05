import "reflect-metadata";

import type { INestApplication, ModuleMetadata } from "@nestjs/common";

import { BullModule } from "@nestjs/bullmq";
import { type NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";

import type { ProviderOverride } from "./auth-test-context.js";

import { env } from "../config/env.js";
import { DatabaseModule } from "../core/database/database.module.js";
import { HttpErrorFilter } from "../core/exceptions/http-error.filter.js";
import { RequestIdMiddleware } from "../core/middleware/request-id.middleware.js";

const JSON_BODY_LIMIT = "1mb";

const TestBullModule = BullModule.forRoot({
  connection: { maxRetriesPerRequest: null, url: env.redisUrl },
  extraOptions: { manualRegistration: true },
});

export async function createTestApp(
  imports: NonNullable<ModuleMetadata["imports"]>,
  overrides: ProviderOverride[] = [],
): Promise<INestApplication> {
  let builder = Test.createTestingModule({
    imports: [DatabaseModule, TestBullModule, ...imports],
  });

  for (const override of overrides) {
    builder = builder.overrideProvider(override.provide).useValue(override.useValue);
  }

  const moduleRef = await builder.compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>();

  const requestIdMiddleware = new RequestIdMiddleware();
  app.use(requestIdMiddleware.use.bind(requestIdMiddleware));

  app.disable("x-powered-by");
  app.use(cookieParser());
  app.useBodyParser("json", { limit: JSON_BODY_LIMIT });
  app.useGlobalFilters(new HttpErrorFilter());

  await app.init();
  return app;
}
