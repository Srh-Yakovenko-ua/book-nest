import { ReceiveShipmentInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class ReceiveShipmentInputDto extends createZodDto(ReceiveShipmentInputSchema) {}
