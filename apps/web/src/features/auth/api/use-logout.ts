import { useMutation } from "@tanstack/react-query";

import { useAuthStore } from "../model/auth-store";
import { logout } from "./session";

export function useLogout() {
  const clearSession = useAuthStore((state) => state.clearSession);

  return useMutation({
    mutationFn: logout,
    onSettled: () => {
      clearSession();
    },
  });
}
