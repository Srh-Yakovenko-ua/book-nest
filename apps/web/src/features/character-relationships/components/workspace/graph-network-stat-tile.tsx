import type { LucideIcon } from "lucide-react";

type GraphNetworkStatTileProps = {
  count: number;
  icon: LucideIcon;
  label: string;
};

export function GraphNetworkStatTile({ count, icon: Icon, label }: GraphNetworkStatTileProps) {
  return (
    <div className="flex min-w-0 flex-col-reverse items-center gap-0.5 px-1 text-center">
      <dt className="text-xs leading-tight break-words text-muted-foreground">{label}</dt>
      <dd className="flex flex-col items-center gap-1 font-heading text-lg leading-none font-semibold text-ink tabular-nums">
        <Icon aria-hidden className="size-4 text-icon" />
        {count}
      </dd>
    </div>
  );
}
