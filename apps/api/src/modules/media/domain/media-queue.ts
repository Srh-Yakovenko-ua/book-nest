import { z } from "zod";

export const MEDIA_QUEUE_NAME = "media";
export const GENERATE_THUMB_JOB = "generate-thumb";

export const GenerateThumbJobSchema = z.object({
  assetId: z.uuid(),
  userId: z.uuid(),
});

export type GenerateThumbJob = z.infer<typeof GenerateThumbJobSchema>;
