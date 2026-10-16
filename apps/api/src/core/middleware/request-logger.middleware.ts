import type { Nullable } from "@app/shared";
import type { NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

import { Injectable } from "@nestjs/common";
import { pinoHttp } from "pino-http";

import { HTTP_STATUS } from "../http-status.js";
import { logger } from "../logger.js";

export type RequestLogFields = {
  id: string;
  ip: Nullable<string>;
  method: string;
  path: string;
  userId: Nullable<string>;
};

export type RequestLogLevel = "error" | "info" | "warn";

export function requestLogFields({
  currentUser,
  id,
  ip,
  method,
  url,
}: {
  currentUser: undefined | { id: string };
  id: string;
  ip: string | undefined;
  method: string;
  url: string;
}): RequestLogFields {
  const [path] = url.split("?");

  return {
    id,
    ip: ip ?? null,
    method,
    path: path ?? url,
    userId: currentUser?.id ?? null,
  };
}

export function requestLogLevel({
  failed,
  statusCode,
}: {
  failed: boolean;
  statusCode: number;
}): RequestLogLevel {
  if (failed) return "error";
  if (statusCode === HTTP_STATUS.SERVICE_UNAVAILABLE) return "warn";
  if (statusCode >= HTTP_STATUS.INTERNAL_SERVER_ERROR) return "error";
  if (statusCode >= HTTP_STATUS.BAD_REQUEST) return "warn";
  return "info";
}

const pinoMiddleware = pinoHttp<Request, Response>({
  customLogLevel: (_req, res, err) =>
    requestLogLevel({ failed: err !== undefined, statusCode: res.statusCode }),
  genReqId: (req) => req.requestId,
  logger,
  serializers: {
    req: (req) =>
      requestLogFields({
        currentUser: req.currentUser,
        id: req.id,
        ip: req.ip,
        method: req.method,
        url: req.url,
      }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
});

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    pinoMiddleware(req, res, next);
  }
}
