import { NotificationListResponseSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class NotificationListResponseDto extends createZodDto(NotificationListResponseSchema) {}
