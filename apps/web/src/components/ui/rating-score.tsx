import { UiIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

const RATING_SCORE_MAX = 10;

type RatingScoreProps = {
  className?: string;
  label?: string;
  value: number;
};

function formatScore(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function RatingScore({ className, label, value }: RatingScoreProps) {
  const text = `${formatScore(value)}/${RATING_SCORE_MAX}`;

  return (
    <span
      aria-label={label ?? text}
      className={cn(
        "inline-flex items-center gap-1 text-sm leading-none font-semibold text-foreground tabular-nums",
        className,
      )}
      data-slot="rating-score"
      role="img"
    >
      <UiIcon aria-hidden className="text-warning" name="star-fill" size={16} />
      <span aria-hidden>{text}</span>
    </span>
  );
}

export { RatingScore };
