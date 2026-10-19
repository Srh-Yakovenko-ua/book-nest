import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { type NestExpressApplication } from "@nestjs/platform-express";
import { SwaggerModule } from "@nestjs/swagger";
import compression from "compression";
import cookieParser from "cookie-parser";
import helmet from "helmet";

import { AppModule } from "./app.module.js";
import { env } from "./config/env.js";
import { registerJsonBodyParser } from "./core/body-parsers.js";
import { HttpErrorFilter } from "./core/exceptions/http-error.filter.js";
import { buildOpenApiDocument } from "./core/openapi.js";
import { CHARACTER_IMPORT_TRANSPORT } from "./modules/characters/api/character-import-transport.js";

export async function bootstrapNestApp(): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
    logger: false,
  });

  app.disable("x-powered-by");
  app.set("trust proxy", env.trustProxy ? 1 : false);
  app.use(helmet());
  app.use(compression());
  app.enableCors({
    credentials: true,
    origin: (origin, cb) => {
      if (!origin) {
        cb(null, true);
        return;
      }
      cb(null, env.corsOrigins.includes(origin));
    },
  });
  app.use(cookieParser());
  registerJsonBodyParser(app, { deferredRoutes: [CHARACTER_IMPORT_TRANSPORT.route] });
  app.useGlobalFilters(new HttpErrorFilter());

  if (env.enableSwagger) {
    const document = buildOpenApiDocument(app);
    SwaggerModule.setup("api/docs", app, document, {
      jsonDocumentUrl: "api/docs/json",
    });
  }

  await app.init();
  return app;
}
