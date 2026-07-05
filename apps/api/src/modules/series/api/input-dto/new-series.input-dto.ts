import { NewSeriesInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class NewSeriesInputDto extends createZodDto(NewSeriesInputSchema) {}
