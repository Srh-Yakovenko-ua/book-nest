import { MarkShipmentInTransitInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class MarkShipmentInTransitInputDto extends createZodDto(MarkShipmentInTransitInputSchema) {}
