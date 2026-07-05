import { UiIcon } from "@/components/icons";

export function SectionCompleteBadge() {
  return (
    <span
      aria-hidden="true"
      className="absolute -right-1 -bottom-1 grid size-[18px] place-items-center rounded-full bg-success text-background ring-2 ring-card motion-safe:animate-in motion-safe:duration-200 motion-safe:zoom-in-50"
    >
      <UiIcon name="check" size={11} />
    </span>
  );
}
