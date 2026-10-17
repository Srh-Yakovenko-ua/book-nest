import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Request } from "express";

const JSON_BODY = {
  limit: "1mb",
  mediaType: "application/json",
} as const;

const TRAILING_SLASHES = /\/+$/;

export type DeferredJsonRoute = {
  method: string;
  path: string;
};

export function registerJsonBodyParser(
  app: NestExpressApplication,
  { deferredRoutes }: { deferredRoutes: readonly DeferredJsonRoute[] },
): void {
  const deferredRouteKeys = new Set(deferredRoutes.map(toRouteKey));
  app.useBodyParser("json", {
    limit: JSON_BODY.limit,
    type: (request: Request) =>
      isJsonRequest(request) && !deferredRouteKeys.has(toRouteKey(request)),
  });
}

function isJsonRequest(request: Request): boolean {
  return typeof request.is(JSON_BODY.mediaType) === "string";
}

function toRouteKey({ method, path }: DeferredJsonRoute): string {
  return `${method.toUpperCase()} ${path.toLowerCase().replace(TRAILING_SLASHES, "")}`;
}
