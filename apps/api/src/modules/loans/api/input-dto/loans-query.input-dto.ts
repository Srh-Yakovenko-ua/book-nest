import { LoansQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class LoansQueryDto extends createZodDto(LoansQuerySchema) {}
