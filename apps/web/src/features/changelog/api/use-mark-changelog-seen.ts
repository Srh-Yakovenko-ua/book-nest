import { useMutation, useQueryClient } from "@tanstack/react-query";

import { changelogControllerMarkSeen } from "@/shared/api/generated/endpoints/changelog/changelog";

import { CHANGELOG_QUERY_PREFIX } from "./use-changelog";

export function useMarkChangelogSeen() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => changelogControllerMarkSeen(),
    onSuccess: () =>
      void queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === CHANGELOG_QUERY_PREFIX,
      }),
  });
}
