import type { NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

import { Injectable } from "@nestjs/common";
import { pinoHttp } from "pino-http";

import { logger } from "../logger.js";

const pinoMiddleware = pinoHttp({
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
  genReqId: (req) => (req as unknown as { requestId: string }).requestId,
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
