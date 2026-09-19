import Image from "next/image";

import { UiIcon } from "@/components/icons";

import type { SeriesSelectOption } from "../model/series-select-option";

export function SeriesSelectThumb({ series }: { series: Pick<SeriesSelectOption, "cover"> }) {
  if (series.cover === null) {
    return (
      <span
        className="grid h-12 w-9 shrink-0 place-items-center rounded-sm bg-accent text-icon"
        data-slot="series-thumb"
      >
        <UiIcon name="layers" size={16} />
      </span>
    );
  }

  return (
    <Image
      alt=""
      className="h-12 w-9 shrink-0 rounded-sm object-cover"
      data-slot="series-thumb"
      height={48}
      src={series.cover.urls.thumb}
      unoptimized
      width={36}
    />
  );
}
