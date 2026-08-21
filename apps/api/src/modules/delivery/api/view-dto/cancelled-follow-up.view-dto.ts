import { CancelledFollowUpViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CancelledFollowUpViewDto extends createZodDto(CancelledFollowUpViewSchema) {}
