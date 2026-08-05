import { useMutation, useQueryClient } from "@tanstack/react-query";

import { notificationsControllerMarkAllRead } from "@/shared/api/generated/endpoints/notifications/notifications";

import { notificationKeys } from "./notification-keys";

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => notificationsControllerMarkAllRead(),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: notificationKeys.root }),
  });
}
