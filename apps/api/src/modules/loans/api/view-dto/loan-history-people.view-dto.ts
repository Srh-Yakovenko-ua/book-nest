import { LoanHistoryPeopleViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class LoanHistoryPeopleViewDto extends createZodDto(LoanHistoryPeopleViewSchema) {}
