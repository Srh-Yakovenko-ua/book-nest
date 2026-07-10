import type { NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

import { Injectable } from "@nestjs/common";

import { MetricsService } from "./metrics.service.js";

const NANOSECONDS_PER_SECOND = 1_000_000_000;
const UNKNOWN_ROUTE = "unknown";

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  constructor(private readonly metricsService: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const startNs = process.hrtime.bigint();
    const method = req.method;
    const inFlightLabels = { method, route: UNKNOWN_ROUTE };
    this.metricsService.httpRequestsInFlight.inc(inFlightLabels);

    res.on("finish", () => {
      const route = resolveRoutePattern(req);
      const statusCode = String(res.statusCode);
      const durationSeconds = Number(process.hrtime.bigint() - startNs) / NANOSECONDS_PER_SECOND;

      this.metricsService.httpRequestsTotal.inc({ method, route, status_code: statusCode });
      this.metricsService.httpRequestDurationSeconds.observe(
        { method, route, status_code: statusCode },
        durationSeconds,
      );
      this.metricsService.httpRequestsInFlight.dec(inFlightLabels);
    });

    res.on("close", () => {
      if (!res.writableEnded) {
        this.metricsService.httpRequestsInFlight.dec(inFlightLabels);
      }
    });

    next();
  }
}

function resolveRoutePattern(req: Request): string {
  const route = req.route;
  if (route?.path) {
    const baseUrl = req.baseUrl ?? "";
    return `${baseUrl}${route.path}`;
  }
  return UNKNOWN_ROUTE;
}
