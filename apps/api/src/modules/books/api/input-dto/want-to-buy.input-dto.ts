import { WantToBuyInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class WantToBuyInputDto extends createZodDto(WantToBuyInputSchema) {}
