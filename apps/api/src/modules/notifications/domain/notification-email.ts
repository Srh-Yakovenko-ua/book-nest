import { z } from "zod";

export const NOTIFICATION_EMAIL_QUEUE_NAME = "notification-email";
export const NOTIFICATION_EMAIL_JOB = "notification-email";

const JOB_ID_SEPARATOR = "_";

export const NotificationEmailJobSchema = z.object({
  userId: z.uuid(),
});

export type NotificationEmailJob = z.infer<typeof NotificationEmailJobSchema>;

export function buildNotificationEmailJobId({
  isoHour,
  userId,
}: {
  isoHour: string;
  userId: string;
}): string {
  return `${userId}${JOB_ID_SEPARATOR}${isoHour}`;
}
