"use client";

import { Info } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

export function QueuePriorityPositionNote() {
  const t = useTranslations("books.organization.priority");

  return (
    <div className="flex gap-2">
      <Info
        aria-hidden
        className="mt-0.5 shrink-0 text-muted-foreground"
        size={16}
        strokeWidth={1.8}
      />
      <p className="text-sm text-muted-foreground">
        {t.rich("positionNote", {
          link: (chunks) => (
            <Link
              className="rounded-sm text-primary underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              href="/reading-queue"
            >
              {chunks}
            </Link>
          ),
        })}
      </p>
    </div>
  );
}
