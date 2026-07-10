import type { NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";

const HEADER = "x-request-id";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.header(HEADER);
    const id = incoming !== undefined && UUID_PATTERN.test(incoming) ? incoming : randomUUID();
    req.requestId = id;
    res.setHeader(HEADER, id);
    next();
  }
}
