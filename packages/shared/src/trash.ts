import { z } from "zod";

export const TRASH_PAGE_SIZE_DEFAULT = 20;

export const TrashDeletionResultSchema = z.object({
  deletedAt: z.iso.datetime(),
  purgeAt: z.iso.datetime(),
});

export type TrashDeletionResult = z.infer<typeof TrashDeletionResultSchema>;
