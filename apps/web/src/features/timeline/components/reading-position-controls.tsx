"use client";

import type { TimelineReadingPosition } from "@app/shared";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type ReadingPositionControlsProps = {
  guardEnabled: boolean;
  onGuardChange: (enabled: boolean) => void;
  onRecapChange: (recap: boolean) => void;
  readingPosition: TimelineReadingPosition;
  recap: boolean;
};

export function ReadingPositionControls({
  guardEnabled,
  onGuardChange,
  onRecapChange,
  readingPosition,
  recap,
}: ReadingPositionControlsProps) {
  const t = useTranslations("timeline");

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {readingPosition.positionKnown ? (
        <Button
          aria-pressed={recap}
          onClick={() => onRecapChange(!recap)}
          size="sm"
          type="button"
          variant={recap ? "default" : "secondary"}
        >
          <UiIcon name="clock" size={14} />
          {t("recap")}
        </Button>
      ) : null}

      <Label className="cursor-pointer gap-2">
        <Switch checked={guardEnabled} onCheckedChange={onGuardChange} size="sm" />
        {t("guard")}
      </Label>
    </div>
  );
}
