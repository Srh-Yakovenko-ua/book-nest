import { afterEach, beforeEach } from "vitest";

export function pinProcessTimezone(timezone: string): void {
  let restore = (): void => undefined;

  beforeEach(() => {
    restore = switchProcessTimezone(timezone);
  });

  afterEach(() => {
    restore();
  });
}

export function switchProcessTimezone(timezone: string): () => void {
  const originalEnvValue = process.env.TZ;
  const originalResolvedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  process.env.TZ = timezone;

  return () => {
    process.env.TZ = originalEnvValue ?? originalResolvedTimezone;
    if (originalEnvValue === undefined) {
      delete process.env.TZ;
    }
  };
}
