import { UpdateSeriesInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class UpdateSeriesInputDto extends createZodDto(UpdateSeriesInputSchema) {}
