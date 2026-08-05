import type { NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

import { Injectable } from "@nestjs/common";
import { pinoHttp } from "pino-http";

import { HTTP_STATUS } from "../http-status.js";
import { logger } from "../logger.js";

export type RequestLogLevel = "error" | "info" | "warn";

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
    req: (req) => ({
      id: req.id,
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
