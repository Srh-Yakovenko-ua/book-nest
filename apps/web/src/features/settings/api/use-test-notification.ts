import { useMutation, useQueryClient } from "@tanstack/react-query";

import { notificationKeys } from "@/features/notifications";
import { notificationsControllerCreateTestNotification } from "@/shared/api/generated/endpoints/notifications/notifications";

export function useTestNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => notificationsControllerCreateTestNotification(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.root });
    },
  });
}
