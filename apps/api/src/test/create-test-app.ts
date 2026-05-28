import "reflect-metadata";

import type { INestApplication, ModuleMetadata } from "@nestjs/common";

import { type NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";

import { DatabaseModule } from "../core/database/database.module.js";
import { HttpErrorFilter } from "../core/exceptions/http-error.filter.js";
import { RequestIdMiddleware } from "../core/middleware/request-id.middleware.js";

const JSON_BODY_LIMIT = "1mb";

export async function createTestApp(
  imports: NonNullable<ModuleMetadata["imports"]>,
): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [DatabaseModule, ...imports],
  }).compile();

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
