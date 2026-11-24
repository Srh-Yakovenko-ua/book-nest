"use client";

import type { ReactNode } from "react";

import { useTranslations } from "next-intl";
import Image from "next/image";

import { HomeCard } from "./home-card";

type HomeMemoryFrameProps = {
  action?: ReactNode;
  children: ReactNode;
};

const MEMORY_ILLUSTRATION = {
  height: 156,
  src: "/illustrations/home/home-book-memory-tea.png",
  width: 260,
} as const;

export function HomeMemoryFrame({ action, children }: HomeMemoryFrameProps) {
  const t = useTranslations("home.memory");

  return (
    <HomeCard
      action={action}
      className="bg-linear-to-br from-card to-accent/40"
      icon="quote"
      title={t("title")}
    >
      <div className="@container/memory flex min-w-0 flex-1 items-end gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-3">{children}</div>
        <Image
          alt=""
          aria-hidden
          className="pointer-events-none hidden h-auto w-24 shrink-0 object-contain select-none @sm/memory:block @lg/memory:w-30"
          height={MEMORY_ILLUSTRATION.height}
          loading="lazy"
          src={MEMORY_ILLUSTRATION.src}
          unoptimized
          width={MEMORY_ILLUSTRATION.width}
        />
      </div>
    </HomeCard>
  );
}
