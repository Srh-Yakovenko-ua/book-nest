import type { ReactNode } from "react";

import { GenreIcon, isGenreIconName } from "@/components/icons";

export function topGenreIconSlot(genreKeys: readonly string[]): ReactNode | undefined {
  const [first, second] = genreKeys.filter(isGenreIconName);
  if (first === undefined) return undefined;
  if (second === undefined) return <GenreIcon name={first} />;

  return (
    <span className="relative size-7">
      <GenreIcon className="absolute top-0 left-0 size-3.5!" name={first} />
      <GenreIcon className="absolute right-0 bottom-0 size-3.5!" name={second} />
    </span>
  );
}
