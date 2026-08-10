"use client";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "@/i18n/navigation";
import { ApiError } from "@/lib/http-client";
import { cn } from "@/lib/utils";

import { useGoalDetail } from "../api/use-goal-detail";
import { GoalDetailsView } from "./goal-details-view";

const NOT_FOUND_STATUS = 404;

type GoalDetailsProps = {
  id: string;
};

export function GoalDetails({ id }: GoalDetailsProps) {
  const t = useTranslations("goals.detail");
  const router = useRouter();
  const { data, error, isPending } = useGoalDetail(id);

  if (isPending) {
    return (
      <output aria-busy="true" aria-label={t("loading")} className="flex flex-col gap-6 lg:gap-8">
        <Skeleton className="h-5 w-40 rounded-md" />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-9 w-72 rounded-lg" />
          <Skeleton className="h-5 w-56 rounded-md" />
        </div>
        <Skeleton className="h-28 w-full rounded-xl" />
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton className="h-16 w-full rounded-lg" key={index} />
          ))}
        </div>
      </output>
    );
  }

  if (error !== null) {
    const isNotFound = error instanceof ApiError && error.status === NOT_FOUND_STATUS;
    return (
      <div
        className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-16 text-center motion-safe:animate-in motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:fade-in motion-safe:slide-in-from-bottom-2"
        role="alert"
      >
        <span
          className={cn(
            "grid size-14 place-items-center rounded-full",
            isNotFound ? "bg-accent text-icon" : "bg-error-soft text-error",
          )}
        >
          <UiIcon name={isNotFound ? "search" : "alert-triangle"} size={28} />
        </span>
        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-xl font-medium text-ink">
            {isNotFound ? t("notFoundTitle") : t("errorTitle")}
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {isNotFound ? t("notFoundDescription") : t("errorDescription")}
          </p>
        </div>
        <Button onClick={() => router.push("/lists")} variant="secondary">
          <UiIcon name="arrow-left" size={16} />
          {t("backToLists")}
        </Button>
      </div>
    );
  }

  return <GoalDetailsView goal={data} />;
}
