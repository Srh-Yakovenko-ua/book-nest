import type { NotificationListResponse, NotificationUnreadCount } from "@app/shared";

import { MarkNotificationsReadInputSchema, NotificationListQuerySchema } from "@app/shared";
import { Body, Controller, Get, HttpCode, Post, Query } from "@nestjs/common";
import {
  ApiAcceptedResponse,
  ApiBody,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import type { AuthenticatedUser } from "../../auth/index.js";

import { HTTP_STATUS } from "../../../core/http-status.js";
import { ZodBodyPipe } from "../../../core/pipes/zod-body.pipe.js";
import { ZodQueryPipe } from "../../../core/pipes/zod-query.pipe.js";
import {
  MANUAL_TEST_NOTIFICATION_THROTTLE,
  MUTATION_THROTTLE,
  READ_THROTTLE,
} from "../../../core/throttle.js";
import { CurrentUser, JwtProtected } from "../../auth/index.js";
import { NotificationsService } from "../application/notifications.service.js";
import { MarkNotificationsReadInputDto } from "./input-dto/mark-notifications-read.input-dto.js";
import { NotificationListQueryDto } from "./input-dto/notification-list-query.input-dto.js";
import { NotificationListResponseDto } from "./view-dto/notification-list-response.view-dto.js";
import { NotificationUnreadCountDto } from "./view-dto/notification-unread-count.view-dto.js";

@ApiTags("notifications")
@Controller("api/notifications")
@JwtProtected()
@Throttle(READ_THROTTLE)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @ApiNotFoundResponse({ description: "The cursor does not point at a notification of the caller" })
  @ApiOkResponse({
    description: "A page of the caller's notifications, newest first, with their unread count",
    type: NotificationListResponseDto,
  })
  @ApiOperation({ summary: "List the current user notifications, newest first" })
  @ApiQuery({ name: "cursor", required: false })
  @ApiQuery({ name: "limit", required: false })
  @ApiQuery({ name: "unreadOnly", required: false })
  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(NotificationListQuerySchema)) query: NotificationListQueryDto,
  ): Promise<NotificationListResponse> {
    return this.notificationsService.list({ query, userId: user.id });
  }

  @ApiOkResponse({
    description: "How many notifications the caller has not read yet",
    type: NotificationUnreadCountDto,
  })
  @ApiOperation({ summary: "Count the current user unread notifications" })
  @Get("unread-count")
  unreadCount(@CurrentUser() user: AuthenticatedUser): Promise<NotificationUnreadCount> {
    return this.notificationsService.unreadCount({ userId: user.id });
  }

  @ApiBody({ type: MarkNotificationsReadInputDto })
  @ApiNoContentResponse({ description: "The listed notifications are marked read" })
  @ApiOperation({ summary: "Mark the given notifications as read" })
  @HttpCode(HTTP_STATUS.NO_CONTENT)
  @Post("read")
  @Throttle(MUTATION_THROTTLE)
  markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodBodyPipe(MarkNotificationsReadInputSchema)) body: MarkNotificationsReadInputDto,
  ): Promise<void> {
    return this.notificationsService.markRead({ ids: body.ids, userId: user.id });
  }

  @ApiNoContentResponse({ description: "Every notification of the caller is marked read" })
  @ApiOperation({ summary: "Mark every notification of the current user as read" })
  @HttpCode(HTTP_STATUS.NO_CONTENT)
  @Post("read-all")
  @Throttle(MUTATION_THROTTLE)
  markAllRead(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.notificationsService.markAllRead({ userId: user.id });
  }

  @ApiAcceptedResponse({ description: "A test notification was recorded for the caller" })
  @ApiOperation({ summary: "Create a test notification for the current user" })
  @HttpCode(HTTP_STATUS.ACCEPTED)
  @Post("test")
  @Throttle(MANUAL_TEST_NOTIFICATION_THROTTLE)
  createTestNotification(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.notificationsService.createTestNotification({ user });
  }
}
