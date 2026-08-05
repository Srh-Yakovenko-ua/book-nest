import { NotificationListQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class NotificationListQueryDto extends createZodDto(NotificationListQuerySchema) {}
