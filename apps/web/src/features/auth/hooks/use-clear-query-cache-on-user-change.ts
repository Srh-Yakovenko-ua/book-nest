"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { useAuthStore } from "../model/auth-store";

export function useClearQueryCacheOnUserChange() {
  const queryClient = useQueryClient();

  useEffect(() => {
    return useAuthStore.subscribe((state, previous) => {
      const previousUserId = previous.user?.id;
      if (previousUserId === undefined) return;
      const nextUserId = state.user?.id;
      if (nextUserId === previousUserId) return;

      if (nextUserId === undefined) {
        queryClient.clear();
        return;
      }

      queryClient.getMutationCache().clear();
      void queryClient.resetQueries();
    });
  }, [queryClient]);
}
