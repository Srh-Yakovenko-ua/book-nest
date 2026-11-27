import type { ReactNode } from "react";

import Image from "next/image";

type CharacterPortraitPlaceholderProps = {
  children: ReactNode;
  sizes: string;
};

export function CharacterPortraitPlaceholder({
  children,
  sizes,
}: CharacterPortraitPlaceholderProps) {
  return (
    <>
      <Image
        alt=""
        className="object-cover select-none"
        fill
        sizes={sizes}
        src="/illustrations/character-portrait-placeholder.png"
      />
      <span className="absolute inset-1/5 grid place-items-center text-cover-ink">{children}</span>
    </>
  );
}
