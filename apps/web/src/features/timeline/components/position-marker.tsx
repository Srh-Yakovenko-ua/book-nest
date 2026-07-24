import { useTranslations } from "next-intl";

export function PositionMarker() {
  const t = useTranslations("timeline");

  return (
    <div aria-label={t("positionMarker")} className="flex items-center gap-2 py-1" role="separator">
      <span aria-hidden className="size-2 shrink-0 rounded-full bg-brand" />
      <span className="text-xs font-semibold tracking-wide text-brand uppercase">
        {t("positionMarker")}
      </span>
      <span aria-hidden className="h-px flex-1 bg-brand/40" />
    </div>
  );
}
