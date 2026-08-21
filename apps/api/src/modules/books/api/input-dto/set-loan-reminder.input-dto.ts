import { SetLoanReminderInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class SetLoanReminderInputDto extends createZodDto(SetLoanReminderInputSchema) {}
