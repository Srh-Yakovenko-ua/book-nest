import type { ApiHealth, ApiLiveness } from "@app/shared";
import type { Response } from "express";

import { Controller, Get, Res } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

import { HTTP_STATUS } from "../../core/http-status.js";
import { HealthService } from "./health.service.js";

@ApiTags("health")
@Controller("api/health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @ApiOperation({ summary: "Service health check" })
  @ApiResponse({ description: "Service is healthy", status: HTTP_STATUS.OK })
  @Get()
  getHealth(): Promise<ApiHealth> {
    return this.healthService.getHealth();
  }

  @ApiOperation({ summary: "Process liveness probe" })
  @ApiResponse({ description: "Process is alive", status: HTTP_STATUS.OK })
  @Get("live")
  getLiveness(): ApiLiveness {
    return this.healthService.getLiveness();
  }

  @ApiOperation({ summary: "Readiness probe covering every runtime dependency" })
  @ApiResponse({ description: "Every dependency is reachable", status: HTTP_STATUS.OK })
  @ApiResponse({
    description: "At least one dependency is unreachable",
    status: HTTP_STATUS.SERVICE_UNAVAILABLE,
  })
  @Get("ready")
  async getReadiness(@Res({ passthrough: true }) response: Response): Promise<ApiHealth> {
    const readiness = await this.healthService.getReadiness();

    response.status(readiness.status === "ok" ? HTTP_STATUS.OK : HTTP_STATUS.SERVICE_UNAVAILABLE);

    return readiness;
  }
}
