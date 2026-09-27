"use client";

import type { TimelineView } from "@app/shared";

import { pickAvailablePaletteColor, TIMELINE_ERROR_CODES } from "@app/shared";
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

import type { TimelineFormValues } from "../model/timeline-form-schema";

import { useCreateTimeline } from "../api/use-create-timeline";
import { useUpdateTimeline } from "../api/use-update-timeline";
import {
  buildTimelineFormSchema,
  TIMELINE_DESCRIPTION_MAX,
  TIMELINE_NAME_MAX,
  timelineFormValuesToInput,
} from "../model/timeline-form-schema";
import { TimelineColorPicker } from "./timeline-color-picker";

type TimelineFormDialogProps = {
  bookId: string;
  onClose: () => void;
  timeline?: TimelineView;
  timelines: TimelineView[];
};

export function TimelineFormDialog({
  bookId,
  onClose,
  timeline,
  timelines,
}: TimelineFormDialogProps) {
  const t = useTranslations("timeline.manage");
  const isEdit = timeline !== undefined;

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      open
    >
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? t("editTitle") : t("createTitle")}</DialogTitle>
          <DialogDescription>
            {isEdit ? t("editDescription") : t("createDescription")}
          </DialogDescription>
        </DialogHeader>
        <TimelineForm
          bookId={bookId}
          onCancel={onClose}
          onSaved={onClose}
          timeline={timeline}
          timelines={timelines}
        />
      </DialogContent>
    </Dialog>
  );
}

function TimelineForm({
  bookId,
  onCancel,
  onSaved,
  timeline,
  timelines,
}: {
  bookId: string;
  onCancel: () => void;
  onSaved: () => void;
  timeline?: TimelineView;
  timelines: TimelineView[];
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
      colorKey:
        timeline?.colorKey ?? pickAvailablePaletteColor(timelines.map((line) => line.colorKey)),
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
  const name = useWatch({ control, name: "name" });
  const isPending = createTimeline.isPending || updateTimeline.isPending;
  const submitLabel = timeline === undefined ? t("submitCreate") : t("submitEdit");

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
            onSaved();
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
          onSaved();
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
          id="timeline-description"
          maxLength={TIMELINE_DESCRIPTION_MAX}
          placeholder={t("descriptionPlaceholder")}
          rows={4}
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
        <Label id="timeline-color-label">{t("markerLabel")}</Label>
        <Controller
          control={control}
          name="colorKey"
          render={({ field }) => (
            <TimelineColorPicker
              labelledBy="timeline-color-label"
              name={name}
              onChange={field.onChange}
              value={field.value}
            />
          )}
        />
      </div>

      <DialogFooter>
        <Button disabled={isPending} onClick={onCancel} type="button" variant="secondary">
          {t("cancel")}
        </Button>
        <Button disabled={isPending} loading={isPending} type="submit">
          {isPending ? tStates("saving") : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}
