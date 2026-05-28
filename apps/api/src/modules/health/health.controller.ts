import type { ApiHealth } from "@app/shared";

import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

import { HealthService } from "./health.service.js";

@ApiTags("Health")
@Controller("api/health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @ApiOperation({ summary: "Service health check" })
  @ApiResponse({ description: "Service is healthy", status: 200 })
  @Get()
  getHealth(): Promise<ApiHealth> {
    return this.healthService.getHealth();
  }
}
