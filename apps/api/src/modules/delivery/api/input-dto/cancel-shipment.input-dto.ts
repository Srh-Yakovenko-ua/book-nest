import { CancelShipmentInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CancelShipmentInputDto extends createZodDto(CancelShipmentInputSchema) {}
