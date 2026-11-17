"use client";

import type { Nullable } from "@app/shared";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";

import { assertNever } from "@/lib/assert-never";

import { useAuthStore } from "../model/auth-store";

type UserChange = "signed-in" | "signed-out" | "switched" | "unchanged";

export function useClearPreviousUserState() {
  const queryClient = useQueryClient();

  useEffect(() => {
    return useAuthStore.subscribe((state, previous) => {
      const change = classifyUserChange({
        nextUserId: state.user?.id ?? null,
        previousUserId: previous.user?.id ?? null,
      });

      switch (change) {
        case "signed-in":
        case "unchanged":
          return;
        case "signed-out":
          toast.dismiss();
          queryClient.clear();
          return;
        case "switched":
          toast.dismiss();
          queryClient.getMutationCache().clear();
          void queryClient.resetQueries();
          return;
        default:
          return assertNever(change);
      }
    });
  }, [queryClient]);
}

function classifyUserChange({
  nextUserId,
  previousUserId,
}: {
  nextUserId: Nullable<string>;
  previousUserId: Nullable<string>;
}): UserChange {
  if (nextUserId === previousUserId) return "unchanged";
  if (previousUserId === null) return "signed-in";
  if (nextUserId === null) return "signed-out";
  return "switched";
}
