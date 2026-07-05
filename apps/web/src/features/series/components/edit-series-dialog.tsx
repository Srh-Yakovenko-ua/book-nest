"use client";

import type { SeriesStatus, SeriesView, UpdateSeriesInput } from "@app/shared";

import { NewSeriesInputSchema, SERIES_DESCRIPTION_MAX } from "@app/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import type { UiIconName } from "@/components/icons";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { ChipGroup } from "@/components/ui/chip-group";
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
import {
  blockNegativeNumberKeys,
  blockNegativeNumberPaste,
} from "@/lib/block-negative-number-keys";
import { ApiError } from "@/lib/http-client";

import { useUpdateSeries } from "../api/use-update-series";

const NAME_MAX = 120;
const TOTAL_BOOKS_MIN = 1;
const TOTAL_BOOKS_MAX = 999;
const DUPLICATE_STATUS = 409;
const UNPROCESSABLE_STATUS = 422;

const STATUS_OPTIONS = [
  { icon: "check-circle", value: "completed" },
  { icon: "clock", value: "ongoing" },
  { icon: "help-circle", value: "unknown" },
] as const satisfies readonly { icon: UiIconName; value: SeriesStatus }[];

type EditSeriesDialogProps = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  series: SeriesView;
};

type EditSeriesFormInput = z.input<typeof NewSeriesInputSchema>;
type EditSeriesFormOutput = z.output<typeof NewSeriesInputSchema>;

export function EditSeriesDialog({ onOpenChange, open, series }: EditSeriesDialogProps) {
  const t = useTranslations("series.editDialog");
  const tFields = useTranslations("series.dialog");

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        {open ? (
          <EditSeriesForm onDone={() => onOpenChange(false)} series={series} tFields={tFields} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function EditSeriesForm({
  onDone,
  series,
  tFields,
}: {
  onDone: () => void;
  series: SeriesView;
  tFields: ReturnType<typeof useTranslations<"series.dialog">>;
}) {
  const t = useTranslations("series.editDialog");
  const tStatus = useTranslations("series.status");
  const tToast = useTranslations("series.toast");
  const updateSeries = useUpdateSeries(series.id);
  const [serverError, setServerError] = useState<null | string>(null);

  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    setError,
  } = useForm<EditSeriesFormInput, unknown, EditSeriesFormOutput>({
    defaultValues: {
      description: series.description ?? "",
      name: series.name,
      status: series.status,
      totalBooks: series.totalBooks ?? undefined,
    },
    mode: "onTouched",
    resolver: zodResolver(NewSeriesInputSchema),
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    const description = values.description?.trim() ?? "";
    const payload: UpdateSeriesInput = {
      description: description.length > 0 ? description : null,
      name: values.name,
      status: values.status,
      totalBooks: values.totalBooks ?? null,
    };
    updateSeries.mutate(payload, {
      onError: (error) => {
        if (error instanceof ApiError && error.status === DUPLICATE_STATUS) {
          setError("name", { message: t("duplicate") });
          return;
        }
        if (error instanceof ApiError && error.status === UNPROCESSABLE_STATUS) {
          setError("totalBooks", { message: t("totalBooksTooLow") });
          return;
        }
        setServerError(t("genericError"));
      },
      onSuccess: () => {
        toast.success(tToast("updated"));
        onDone();
      },
    });
  });

  return (
    <form className="flex flex-col gap-4" noValidate onSubmit={onSubmit}>
      <div className="flex flex-col gap-2">
        <Label htmlFor="edit-series-name">{tFields("name")}</Label>
        <Input
          aria-describedby={errors.name ? "edit-series-name-error" : undefined}
          aria-invalid={errors.name !== undefined}
          autoComplete="off"
          className="h-10"
          id="edit-series-name"
          maxLength={NAME_MAX}
          placeholder={tFields("namePlaceholder")}
          {...register("name")}
        />
        <FieldError error={errors.name} id="edit-series-name-error" />
      </div>

      <div className="flex flex-col gap-2">
        <Label>{tFields("status")}</Label>
        <Controller
          control={control}
          name="status"
          render={({ field }) => (
            <ChipGroup
              label={tFields("status")}
              mode="single"
              onValueChange={(value) => field.onChange(value)}
              options={STATUS_OPTIONS.map((option) => ({
                icon: <UiIcon name={option.icon} size={16} />,
                label: tStatus(option.value),
                value: option.value,
              }))}
              size="sm"
              value={field.value ?? "unknown"}
            />
          )}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="edit-series-total-books">
          {tFields("totalBooks")}{" "}
          <span className="text-xs font-normal text-muted-foreground">{tFields("optional")}</span>
        </Label>
        <Controller
          control={control}
          name="totalBooks"
          render={({ field }) => (
            <Input
              aria-describedby={errors.totalBooks ? "edit-series-total-books-error" : undefined}
              aria-invalid={errors.totalBooks !== undefined}
              autoComplete="off"
              className="h-10 sm:w-40"
              id="edit-series-total-books"
              inputMode="numeric"
              max={TOTAL_BOOKS_MAX}
              min={TOTAL_BOOKS_MIN}
              onChange={(event) =>
                field.onChange(event.target.value === "" ? undefined : Number(event.target.value))
              }
              onKeyDown={blockNegativeNumberKeys}
              onPaste={blockNegativeNumberPaste}
              placeholder={tFields("totalBooksPlaceholder")}
              step={1}
              type="number"
              value={field.value ?? ""}
            />
          )}
        />
        <FieldError error={errors.totalBooks} id="edit-series-total-books-error" />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="edit-series-description">
          {tFields("descriptionLabel")}{" "}
          <span className="text-xs font-normal text-muted-foreground">{tFields("optional")}</span>
        </Label>
        <Controller
          control={control}
          name="description"
          render={({ field }) => (
            <>
              <Textarea
                aria-describedby="edit-series-description-counter"
                id="edit-series-description"
                maxLength={SERIES_DESCRIPTION_MAX}
                onChange={field.onChange}
                placeholder={tFields("descriptionPlaceholder")}
                value={field.value ?? ""}
              />
              <span
                className="ml-auto text-xs text-muted-foreground tabular-nums"
                id="edit-series-description-counter"
              >
                {(field.value ?? "").length}/{SERIES_DESCRIPTION_MAX}
              </span>
            </>
          )}
        />
      </div>

      {serverError === null ? null : (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {serverError}
        </p>
      )}

      <DialogFooter>
        <Button onClick={onDone} type="button" variant="secondary">
          {tFields("cancel")}
        </Button>
        <Button disabled={updateSeries.isPending} loading={updateSeries.isPending} type="submit">
          {t("submit")}
        </Button>
      </DialogFooter>
    </form>
  );
}
