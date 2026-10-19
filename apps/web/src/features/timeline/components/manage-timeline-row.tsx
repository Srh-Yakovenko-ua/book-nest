import type { TimelineView } from "@app/shared";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { TruncatedText } from "@/components/truncated-text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { markerStyle } from "../model/color-key";

type ManageTimelineRowProps = {
  canMoveDown: boolean;
  canMoveUp: boolean;
  isBusy: boolean;
  onDelete: (timeline: TimelineView) => void;
  onEdit: (timeline: TimelineView) => void;
  onMakeDefault: (timeline: TimelineView) => void;
  onMove: (direction: "down" | "up") => void;
  timeline: TimelineView;
};

export function ManageTimelineRow({
  canMoveDown,
  canMoveUp,
  isBusy,
  onDelete,
  onEdit,
  onMakeDefault,
  onMove,
  timeline,
}: ManageTimelineRowProps) {
  const t = useTranslations("timeline.manage");

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
      <span
        aria-hidden
        className="size-3 shrink-0 rounded-full"
        style={markerStyle(timeline.colorKey)}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-2">
          <TruncatedText className="text-sm font-medium text-foreground" text={timeline.name} />
          {timeline.isDefault ? (
            <Badge className="shrink-0" variant="secondary">
              {t("defaultBadge")}
            </Badge>
          ) : null}
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          {t("eventCount", { count: timeline.eventsCount })}
        </span>
      </div>

      <div className="order-last flex w-full shrink-0 items-center justify-end gap-1 sm:order-none sm:w-auto">
        <Button
          aria-label={t("moveUp", { name: timeline.name })}
          className="size-9"
          disabled={!canMoveUp || isBusy}
          onClick={() => onMove("up")}
          size="icon-sm"
          variant="ghost"
        >
          <UiIcon name="arrow-up" size={16} />
        </Button>
        <Button
          aria-label={t("moveDown", { name: timeline.name })}
          className="size-9"
          disabled={!canMoveDown || isBusy}
          onClick={() => onMove("down")}
          size="icon-sm"
          variant="ghost"
        >
          <UiIcon name="arrow-down" size={16} />
        </Button>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={t("rowMenu", { name: timeline.name })}
            className="size-9 shrink-0"
            size="icon-sm"
            variant="ghost"
          >
            <UiIcon name="more" size={18} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuItem disabled={isBusy} onSelect={() => onEdit(timeline)}>
            <UiIcon name="edit" size={16} />
            {t("edit")}
          </DropdownMenuItem>
          {timeline.isDefault ? null : (
            <DropdownMenuItem disabled={isBusy} onSelect={() => onMakeDefault(timeline)}>
              <UiIcon name="star" size={16} />
              {t("setDefault")}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={timeline.isDefault || isBusy}
            onSelect={() => onDelete(timeline)}
            variant="destructive"
          >
            <UiIcon name="trash" size={16} />
            {t("delete")}
          </DropdownMenuItem>
          {timeline.isDefault ? (
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              {t("deleteDefaultHint")}
            </DropdownMenuLabel>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
