import type { Nullable } from "@app/shared";

import { secondsInHour, secondsInMinute } from "date-fns/constants";

const AUDIO_POSITION = {
  partWidth: 2,
  pattern: /^(?:(\d{1,4}):)?([0-5]?\d):([0-5]\d)$/,
  separator: ":",
} as const;

export function formatAudioPosition(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / secondsInHour);
  const minutes = Math.floor((totalSeconds % secondsInHour) / secondsInMinute);
  const seconds = totalSeconds % secondsInMinute;
  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(AUDIO_POSITION.partWidth, "0"))
    .join(AUDIO_POSITION.separator);
}

export function parseAudioPosition(value: string): Nullable<number> {
  const match = AUDIO_POSITION.pattern.exec(value.trim());
  if (match === null) return null;
  const [, hours = "0", minutes = "0", seconds = "0"] = match;
  return Number(hours) * secondsInHour + Number(minutes) * secondsInMinute + Number(seconds);
}
