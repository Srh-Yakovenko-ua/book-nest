import type { Response } from "express";

import { Controller, Get, Res } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

import { MetricsService } from "./metrics.service.js";

@ApiTags("Observability")
@Controller("api/metrics")
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @ApiOperation({ summary: "Prometheus scrape endpoint" })
  @ApiResponse({ description: "Prometheus text exposition format", status: 200 })
  @Get()
  async getMetrics(@Res() res: Response): Promise<void> {
    const body = await this.metricsService.render();
    res.setHeader("Content-Type", this.metricsService.contentType);
    res.send(body);
  }
}
