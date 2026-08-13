import { ExtendLoanInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class ExtendLoanInputDto extends createZodDto(ExtendLoanInputSchema) {}
