import { NotificationUnreadCountSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class NotificationUnreadCountDto extends createZodDto(NotificationUnreadCountSchema) {}
