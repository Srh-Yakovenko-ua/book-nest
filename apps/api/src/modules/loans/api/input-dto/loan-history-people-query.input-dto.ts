import { LoanHistoryPeopleQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class LoanHistoryPeopleQueryDto extends createZodDto(LoanHistoryPeopleQuerySchema) {}
