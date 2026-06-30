import { BulkFavoriteInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class BulkFavoriteInputDto extends createZodDto(BulkFavoriteInputSchema) {}
