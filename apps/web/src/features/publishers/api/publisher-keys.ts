import type { PublishersControllerLibraryListParams } from "@/shared/api/generated/model";

const PUBLISHERS_ROOT = "/api/publishers";

export const publisherKeys = {
  detail: (id: string) => [PUBLISHERS_ROOT, "detail", id] as const,
  list: (params: PublishersControllerLibraryListParams) =>
    [PUBLISHERS_ROOT, "list", params] as const,
  root: [PUBLISHERS_ROOT] as const,
  summary: [PUBLISHERS_ROOT, "summary"] as const,
};
