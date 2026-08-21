import { ReceiveShipmentsInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class ReceiveShipmentsInputDto extends createZodDto(ReceiveShipmentsInputSchema) {}
