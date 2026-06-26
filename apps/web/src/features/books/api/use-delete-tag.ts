import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { tagsControllerDelete } from "@/shared/api/generated/endpoints/tags/tags";

export function useDeleteTag() {
  const queryClient = useQueryClient();
  const t = useTranslations("books.classification");

  return useMutation({
    mutationFn: (tagId: string) => tagsControllerDelete(tagId),
    onError: () => toast.error(t("tagsDeleteError")),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tags", "search"] });
      toast.success(t("tagsDeleteSuccess"));
    },
  });
}
