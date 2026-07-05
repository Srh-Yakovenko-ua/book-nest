import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useAuthStore } from "../model/auth-store";
import { logout } from "./session";

export function useLogout() {
  const clearSession = useAuthStore((state) => state.clearSession);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logout,
    onSettled: () => {
      clearSession();
      queryClient.clear();
    },
  });
}
