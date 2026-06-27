import type { MediaKind, MediaView } from "@app/shared";

import { MediaViewSchema } from "@app/shared";
import { useMutation } from "@tanstack/react-query";

import { request } from "@/lib/http-client";

type UploadMediaInput = {
  file: File;
  kind?: MediaKind;
};

export function useUploadMedia() {
  return useMutation({
    mutationFn: async ({ file, kind = "book_cover" }: UploadMediaInput): Promise<MediaView> => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("kind", kind);

      const response = await request<unknown>("/api/media", { body: formData, method: "POST" });
      return MediaViewSchema.parse(response);
    },
  });
}
