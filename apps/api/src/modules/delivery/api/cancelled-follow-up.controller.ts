import type { CancelledFollowUpView, CancelledFollowUpWishlistResult } from "@app/shared";

import { Controller, Get, HttpCode, Post } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import type { AuthenticatedUser } from "../../auth/index.js";

import { HTTP_STATUS } from "../../../core/http-status.js";
import { MUTATION_THROTTLE, READ_THROTTLE } from "../../../core/throttle.js";
import { CurrentUser, JwtProtected } from "../../auth/index.js";
import { CancelledFollowUpService } from "../application/cancelled-follow-up.service.js";
import { CancelledFollowUpWishlistResultDto } from "./view-dto/cancelled-follow-up-wishlist-result.view-dto.js";
import { CancelledFollowUpViewDto } from "./view-dto/cancelled-follow-up.view-dto.js";

@ApiTags("delivery-read")
@Controller("api/delivery/books/history/cancelled-follow-up")
@JwtProtected()
export class CancelledFollowUpController {
  constructor(private readonly cancelledFollowUpService: CancelledFollowUpService) {}

  @ApiOkResponse({
    description: "Cancelled books left without a next step, and the plans still counting on them",
    type: CancelledFollowUpViewDto,
  })
  @ApiOperation({
    summary: "Get the cancelled books that never reached a next acquisition state",
  })
  @Get()
  @Throttle(READ_THROTTLE)
  read(@CurrentUser() user: AuthenticatedUser): Promise<CancelledFollowUpView> {
    return this.cancelledFollowUpService.read({ userId: user.id });
  }

  @ApiOkResponse({
    description: "How many books were moved to the wishlist",
    type: CancelledFollowUpWishlistResultDto,
  })
  @ApiOperation({
    summary: "Move every cancelled book still without a next step to the wishlist",
  })
  @HttpCode(HTTP_STATUS.OK)
  @Post("want-to-buy")
  @Throttle(MUTATION_THROTTLE)
  returnAllToWishlist(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CancelledFollowUpWishlistResult> {
    return this.cancelledFollowUpService.returnAllToWishlist({ userId: user.id });
  }
}
