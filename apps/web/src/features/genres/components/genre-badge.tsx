import { GenreIcon, isGenreIconName, UiIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

type GenreBadgeProps = {
  genreKey: string;
  size: keyof typeof GENRE_BADGE_SIZES;
};

const GENRE_BADGE_SIZES = {
  card: { className: "size-10", fallbackIcon: 18, icon: 20 },
  row: { className: "size-8", fallbackIcon: 14, icon: 16 },
} as const;

export function GenreBadge({ genreKey, size }: GenreBadgeProps) {
  const dimensions = GENRE_BADGE_SIZES[size];

  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-genre-soft text-genre",
        dimensions.className,
      )}
    >
      {isGenreIconName(genreKey) ? (
        <GenreIcon name={genreKey} size={dimensions.icon} />
      ) : (
        <UiIcon name="hash" size={dimensions.fallbackIcon} />
      )}
    </span>
  );
}
