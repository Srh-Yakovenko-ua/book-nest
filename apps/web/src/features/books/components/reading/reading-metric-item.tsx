import { UiIcon, type UiIconName } from "@/components/icons";
import { cn } from "@/lib/utils";

type ReadingMetricItemProps = {
  className?: string;
  hint?: string;
  icon?: UiIconName;
  value: string;
};

export function ReadingMetricItem({ className, hint, icon, value }: ReadingMetricItemProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-lg border border-border/60 bg-secondary/30 px-3 py-2.5",
        className,
      )}
    >
      {icon === undefined ? null : (
        <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md bg-accent text-icon">
          <UiIcon name={icon} size={15} />
        </span>
      )}
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-medium text-foreground">{value}</span>
        {hint === undefined ? null : (
          <span className="text-xs text-muted-foreground tabular-nums">{hint}</span>
        )}
      </div>
    </div>
  );
}
