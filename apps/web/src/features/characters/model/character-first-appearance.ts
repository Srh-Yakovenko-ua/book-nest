import { secondsInHour, secondsInMinute } from "date-fns/constants";

const CLOCK_PART_WIDTH = 2;

export function formatAudioPosition(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / secondsInHour);
  const minutes = Math.floor((totalSeconds % secondsInHour) / secondsInMinute);
  const seconds = totalSeconds % secondsInMinute;
  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(CLOCK_PART_WIDTH, "0"))
    .join(":");
}
