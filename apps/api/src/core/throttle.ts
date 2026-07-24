import { seconds } from "@nestjs/throttler";

const THROTTLE_WINDOW_SECONDS = 60;
const MUTATION_LIMIT = 60;
const READ_LIMIT = 120;

export const MUTATION_THROTTLE = {
  default: { limit: MUTATION_LIMIT, ttl: seconds(THROTTLE_WINDOW_SECONDS) },
};

export const READ_THROTTLE = {
  default: { limit: READ_LIMIT, ttl: seconds(THROTTLE_WINDOW_SECONDS) },
};
