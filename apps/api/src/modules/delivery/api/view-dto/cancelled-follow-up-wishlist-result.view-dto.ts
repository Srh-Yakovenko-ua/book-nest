import { CancelledFollowUpWishlistResultSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CancelledFollowUpWishlistResultDto extends createZodDto(
  CancelledFollowUpWishlistResultSchema,
) {}
