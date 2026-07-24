import type { DeliveryServiceView, Paginator } from "@app/shared";

import {
  RecentDeliveryServicesQuerySchema,
  TaxonomySearchPaginationQuerySchema,
} from "@app/shared";
import { Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import {
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";

import type { AuthenticatedUser } from "../../auth/index.js";

import { HTTP_STATUS } from "../../../core/http-status.js";
import { ZodQueryPipe } from "../../../core/pipes/zod-query.pipe.js";
import { CurrentUser, JwtProtected } from "../../auth/index.js";
import { DeliveryServicesService } from "../application/delivery-services.service.js";
import { DeliveryServicesSearchQueryDto } from "./input-dto/delivery-services-search-query.input-dto.js";
import { RecentDeliveryServicesQueryDto } from "./input-dto/recent-delivery-services-query.input-dto.js";

@ApiTags("delivery-services")
@Controller("api/delivery-services")
export class DeliveryServicesController {
  constructor(private readonly deliveryServicesService: DeliveryServicesService) {}
  @ApiOkResponse({
    description: "A page of the global default and current user custom delivery services",
  })
  @ApiOperation({ summary: "Search delivery services (global defaults + own custom)" })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "pageNumber", required: false })
  @ApiQuery({ name: "pageSize", required: false })
  @Get()
  @JwtProtected()
  search(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(TaxonomySearchPaginationQuerySchema))
    query: DeliveryServicesSearchQueryDto,
  ): Promise<Paginator<DeliveryServiceView>> {
    return this.deliveryServicesService.search(user.id, query);
  }
  @ApiOkResponse({
    description: "Delivery services the current user recently used in their own book deliveries",
  })
  @ApiOperation({ summary: "List recently used delivery services for the current user" })
  @ApiQuery({ name: "limit", required: false })
  @Get("recent")
  @JwtProtected()
  recent(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(RecentDeliveryServicesQuerySchema))
    query: RecentDeliveryServicesQueryDto,
  ): Promise<DeliveryServiceView[]> {
    return this.deliveryServicesService.recent({ limit: query.limit, userId: user.id });
  }
  @ApiNoContentResponse({ description: "The delivery service was deleted" })
  @ApiNotFoundResponse({ description: "Delivery service not found" })
  @ApiOperation({ summary: "Delete a custom delivery service of the current user" })
  @Delete(":id")
  @HttpCode(HTTP_STATUS.NO_CONTENT)
  @JwtProtected()
  delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.deliveryServicesService.delete(user.id, id);
  }
}
