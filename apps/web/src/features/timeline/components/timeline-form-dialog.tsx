"use client";

import type { Nullable, TimelineColorKey, TimelineView } from "@app/shared";

import { TIMELINE_COLOR_KEYS, TIMELINE_ERROR_CODES } from "@app/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/http-client";
import { cn } from "@/lib/utils";

import type { TimelineFormValues } from "../model/timeline-form-schema";

import { useCreateTimeline } from "../api/use-create-timeline";
import { useUpdateTimeline } from "../api/use-update-timeline";
import { markerClass } from "../model/color-key";
import {
  buildTimelineFormSchema,
  TIMELINE_DESCRIPTION_MAX,
  TIMELINE_NAME_MAX,
  timelineFormValuesToInput,
} from "../model/timeline-form-schema";

type TimelineFormDialogProps = {
  bookId: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  timeline?: TimelineView;
};

export function TimelineFormDialog({
  bookId,
  onOpenChange,
  open,
  timeline,
}: TimelineFormDialogProps) {
  const t = useTranslations("timeline.manage");
  const isEdit = timeline !== undefined;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? t("editTitle") : t("createTitle")}</DialogTitle>
          <DialogDescription>
            {isEdit ? t("editDescription") : t("createDescription")}
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <TimelineForm bookId={bookId} onDone={() => onOpenChange(false)} timeline={timeline} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ColorPicker({
  onChange,
  value,
}: {
  onChange: (value: Nullable<TimelineColorKey>) => void;
  value: Nullable<TimelineColorKey>;
}) {
  const t = useTranslations("timeline.manage");
  const tColor = useTranslations("timeline.colorKey");

  const options: Nullable<TimelineColorKey>[] = [null, ...TIMELINE_COLOR_KEYS];
  const selectedLabel = value === null ? t("markerNone") : tColor(value);

  return (
    <div className="flex flex-col gap-2">
      <div aria-label={t("markerLabel")} className="flex flex-wrap gap-2" role="radiogroup">
        {options.map((key) => {
          const selected = value === key;
          const label = key === null ? t("markerNone") : tColor(key);

          return (
            <label className="cursor-pointer" key={key ?? "none"}>
              <input
                checked={selected}
                className="peer sr-only"
                name="timeline-color"
                onChange={() => onChange(key)}
                type="radio"
                value={key ?? ""}
              />
              <span
                aria-hidden
                className={cn(
                  "grid size-7 place-items-center rounded-full border-2 border-transparent transition-colors peer-hover:border-border peer-focus-visible:border-ring",
                  selected && "border-foreground peer-hover:border-foreground",
                )}
              >
                <span className={cn("size-4 rounded-full", markerClass(key))} />
              </span>
              <span className="sr-only">{label}</span>
            </label>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">{selectedLabel}</p>
    </div>
  );
}

function TimelineForm({
  bookId,
  onDone,
  timeline,
}: {
  bookId: string;
  onDone: () => void;
  timeline?: TimelineView;
}) {
  const t = useTranslations("timeline.manage");
  const tStates = useTranslations("timeline.states");
  const tErrors = useTranslations("timeline.errors");
  const tToast = useTranslations("timeline.toast");

  const createTimeline = useCreateTimeline();
  const updateTimeline = useUpdateTimeline();

  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    setError,
    setFocus,
  } = useForm<TimelineFormValues>({
    defaultValues: {
      colorKey: timeline?.colorKey ?? null,
      description: timeline?.description ?? "",
      name: timeline?.name ?? "",
    },
    mode: "onTouched",
    resolver: zodResolver(
      buildTimelineFormSchema({
        descriptionTooLong: tErrors("tooLong", { max: TIMELINE_DESCRIPTION_MAX }),
        nameEmpty: t("nameRequired"),
        nameTooLong: tErrors("tooLong", { max: TIMELINE_NAME_MAX }),
      }),
    ),
  });

  useEffect(() => {
    setFocus("name");
  }, [setFocus]);

  const description = useWatch({ control, name: "description" });
  const isPending = createTimeline.isPending || updateTimeline.isPending;

  const onSubmit = handleSubmit((values) => {
    const input = timelineFormValuesToInput(values);

    const onError = (error: unknown) => {
      if (
        error instanceof ApiError &&
        (error.code === TIMELINE_ERROR_CODES.duplicateName || error.status === 409)
      ) {
        setError("name", { message: t("duplicateName") }, { shouldFocus: true });
        return;
      }
      toast.error(tToast("lineError"));
    };

    if (timeline !== undefined) {
      updateTimeline.mutate(
        { bookId, input, timelineId: timeline.id },
        {
          onError,
          onSuccess: () => {
            toast.success(tToast("lineUpdated"));
            onDone();
          },
        },
      );
      return;
    }

    createTimeline.mutate(
      { bookId, input },
      {
        onError,
        onSuccess: () => {
          toast.success(tToast("lineCreated"));
          onDone();
        },
      },
    );
  });

  return (
    <form className="flex flex-col gap-4" noValidate onSubmit={onSubmit}>
      <div className="flex flex-col gap-2">
        <Label htmlFor="timeline-name">
          {t("nameLabel")}{" "}
          <span aria-hidden className="text-destructive">
            *
          </span>
        </Label>
        <Input
          aria-describedby={errors.name ? "timeline-name-error" : undefined}
          aria-invalid={errors.name !== undefined}
          aria-required
          autoComplete="off"
          className="h-10"
          id="timeline-name"
          maxLength={TIMELINE_NAME_MAX}
          placeholder={t("namePlaceholder")}
          {...register("name")}
        />
        <FieldError error={errors.name} id="timeline-name-error" />
      </div>

      <div className="flex flex-col gap-2">
        <Label className="flex-wrap" htmlFor="timeline-description">
          {t("descriptionLabel")}{" "}
          <span className="text-xs font-normal text-muted-foreground">{t("optional")}</span>
        </Label>
        <Textarea
          aria-describedby={
            errors.description
              ? "timeline-description-error timeline-description-counter"
              : "timeline-description-counter"
          }
          aria-invalid={errors.description !== undefined}
          className="min-h-20"
          id="timeline-description"
          maxLength={TIMELINE_DESCRIPTION_MAX}
          placeholder={t("descriptionPlaceholder")}
          {...register("description")}
        />
        <div className="flex items-center justify-between gap-2">
          <FieldError error={errors.description} id="timeline-description-error" />
          <span
            className="ml-auto text-xs text-muted-foreground tabular-nums"
            id="timeline-description-counter"
          >
            {description.length} / {TIMELINE_DESCRIPTION_MAX}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label className="flex-wrap">
          {t("markerLabel")}{" "}
          <span className="text-xs font-normal text-muted-foreground">{t("optional")}</span>
        </Label>
        <Controller
          control={control}
          name="colorKey"
          render={({ field }) => <ColorPicker onChange={field.onChange} value={field.value} />}
        />
      </div>

      <DialogFooter>
        <Button disabled={isPending} onClick={onDone} type="button" variant="secondary">
          {t("cancel")}
        </Button>
        <Button disabled={isPending} loading={isPending} type="submit">
          {isPending ? tStates("saving") : t("save")}
        </Button>
      </DialogFooter>
    </form>
  );
}
