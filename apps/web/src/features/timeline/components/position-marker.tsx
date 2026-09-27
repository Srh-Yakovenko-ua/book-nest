import { useTranslations } from "next-intl";

type PositionMarkerProps = {
  page: number;
};

export function PositionMarker({ page }: PositionMarkerProps) {
  const t = useTranslations("timeline");
  const label = t("positionMarker", { page });

  return (
    <div aria-label={label} className="flex items-center gap-3 py-1" role="separator">
      <span aria-hidden className="flex w-3 shrink-0 justify-center">
        <span className="size-2.5 rounded-full bg-brand ring-4 ring-card" />
      </span>
      <span className="text-xs font-semibold tracking-wide text-brand uppercase">{label}</span>
      <span aria-hidden className="h-px flex-1 bg-brand/40" />
    </div>
  );
}
