"use client";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Illustration } from "@/components/illustration";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "@/i18n/navigation";
import { HTTP_STATUS, isApiErrorStatus } from "@/lib/api-errors";

import { useGoalDetail } from "../api/use-goal-detail";
import { GoalDetailsView } from "./goal-details-view";

type GoalDetailsProps = {
  id: string;
};

export function GoalDetails({ id }: GoalDetailsProps) {
  const t = useTranslations("goals.detail");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { data, error, isFetching, isPending, refetch } = useGoalDetail(id);

  if (isPending) {
    return (
      <output aria-busy="true" aria-label={t("loading")} className="flex flex-col gap-6">
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

  if (data === undefined) {
    const isNotFound = isApiErrorStatus(error, HTTP_STATUS.notFound);
    return (
      <div
        className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-16 text-center motion-safe:animate-in motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:fade-in motion-safe:slide-in-from-bottom-2"
        role="alert"
      >
        <Illustration name={isNotFound ? "error-not-found" : "error-generic"} size="sm" />
        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-xl font-medium text-ink">
            {isNotFound ? t("notFoundTitle") : t("errorTitle")}
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {isNotFound ? t("notFoundDescription") : t("errorDescription")}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {isNotFound ? null : (
            <Button disabled={isFetching} onClick={() => void refetch()}>
              <UiIcon name="refresh" size={16} />
              {tCommon("retry")}
            </Button>
          )}
          <Button onClick={() => router.push("/goals")} variant="secondary">
            <UiIcon name="arrow-left" size={16} />
            {t("backToGoals")}
          </Button>
        </div>
      </div>
    );
  }

  return <GoalDetailsView goal={data} />;
}
