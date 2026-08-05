import { MarkNotificationsReadInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class MarkNotificationsReadInputDto extends createZodDto(MarkNotificationsReadInputSchema) {}
