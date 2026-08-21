import { seconds } from "@nestjs/throttler";

const THROTTLE_WINDOW_SECONDS = 60;

const THROTTLE_LIMITS = {
  global: 120,
  heavyRead: 30,
  manualTestNotification: 3,
  mutation: 60,
  read: 120,
} as const;

const perWindow = (limit: number) => ({ limit, ttl: seconds(THROTTLE_WINDOW_SECONDS) });

export const GLOBAL_THROTTLE = perWindow(THROTTLE_LIMITS.global);

export const MUTATION_THROTTLE = { default: perWindow(THROTTLE_LIMITS.mutation) };

export const READ_THROTTLE = { default: perWindow(THROTTLE_LIMITS.read) };

export const HEAVY_READ_THROTTLE = { default: perWindow(THROTTLE_LIMITS.heavyRead) };

export const MANUAL_TEST_NOTIFICATION_THROTTLE = {
  default: perWindow(THROTTLE_LIMITS.manualTestNotification),
};
