import { seconds } from "@nestjs/throttler";

const THROTTLE_WINDOW_SECONDS = 60;
const GLOBAL_LIMIT = 120;
const MUTATION_LIMIT = 60;
const READ_LIMIT = 120;
const MANUAL_TEST_NOTIFICATION_LIMIT = 3;

export const GLOBAL_THROTTLE = {
  limit: GLOBAL_LIMIT,
  ttl: seconds(THROTTLE_WINDOW_SECONDS),
};

export const MUTATION_THROTTLE = {
  default: { limit: MUTATION_LIMIT, ttl: seconds(THROTTLE_WINDOW_SECONDS) },
};

export const READ_THROTTLE = {
  default: { limit: READ_LIMIT, ttl: seconds(THROTTLE_WINDOW_SECONDS) },
};

export const MANUAL_TEST_NOTIFICATION_THROTTLE = {
  default: { limit: MANUAL_TEST_NOTIFICATION_LIMIT, ttl: seconds(THROTTLE_WINDOW_SECONDS) },
};
