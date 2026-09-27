import type { TagDeletionPreviewView } from "@app/shared";

import { TagDeletionPreviewViewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import { tagsControllerDeletionPreview } from "@/shared/api/generated/endpoints/tags/tags";

import { tagsKeys } from "./tags-keys";

export function useTagDeletionPreview(tagId: string) {
  return useQuery({
    queryFn: async ({ signal }): Promise<TagDeletionPreviewView> =>
      TagDeletionPreviewViewSchema.parse(await tagsControllerDeletionPreview(tagId, { signal })),
    queryKey: tagsKeys.deletionPreview(tagId),
    refetchOnMount: "always",
    retry: false,
    staleTime: 0,
  });
}
