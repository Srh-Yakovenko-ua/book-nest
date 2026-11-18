import { cn } from "@/lib/utils";

import { READING_INTENSITY_CLASS } from "./reading-intensity";

export function ReadingIntensityMeter({ className, level }: { className?: string; level: number }) {
  return (
    <span aria-hidden className={cn(READING_INTENSITY_CLASS.meter.track, className)}>
      <span
        className={cn(
          READING_INTENSITY_CLASS.meter.fill,
          READING_INTENSITY_CLASS.meter.fillWidth[level],
        )}
      />
    </span>
  );
}
