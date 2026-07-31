import { useMutation, useQueryClient } from "@tanstack/react-query";

import { notificationsControllerMarkRead } from "@/shared/api/generated/endpoints/notifications/notifications";

import { notificationKeys } from "./notification-keys";

export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) => notificationsControllerMarkRead({ ids }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: notificationKeys.root }),
  });
}
