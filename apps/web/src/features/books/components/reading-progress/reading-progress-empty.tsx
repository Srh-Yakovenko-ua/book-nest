import { UiIcon, type UiIconName } from "@/components/icons";

type ReadingProgressEmptyProps = {
  icon?: UiIconName;
  message: string;
};

export function ReadingProgressEmpty({ icon = "chart", message }: ReadingProgressEmptyProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-8 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-accent text-icon">
        <UiIcon name={icon} size={22} />
      </span>
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{message}</p>
    </div>
  );
}
