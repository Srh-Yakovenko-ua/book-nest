"use client";

import type { NewSeriesInput, SeriesStatus } from "@app/shared";

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

import { useCreateSeries } from "../api/use-create-series";

const NAME_MAX = 120;
const TOTAL_BOOKS_MIN = 1;
const TOTAL_BOOKS_MAX = 999;
const DUPLICATE_STATUS = 409;

const STATUS_OPTIONS = [
  { icon: "check-circle", value: "completed" },
  { icon: "clock", value: "ongoing" },
  { icon: "help-circle", value: "unknown" },
] as const satisfies readonly { icon: UiIconName; value: SeriesStatus }[];

type CreateSeriesDialogProps = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

type CreateSeriesFormInput = z.input<typeof NewSeriesInputSchema>;
type CreateSeriesFormOutput = z.output<typeof NewSeriesInputSchema>;

export function CreateSeriesDialog({ onOpenChange, open }: CreateSeriesDialogProps) {
  const t = useTranslations("series.dialog");

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        {open ? <CreateSeriesForm onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function CreateSeriesForm({ onDone }: { onDone: () => void }) {
  const t = useTranslations("series.dialog");
  const tStatus = useTranslations("series.status");
  const tToast = useTranslations("series.toast");
  const createSeries = useCreateSeries();
  const [serverError, setServerError] = useState<null | string>(null);

  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<CreateSeriesFormInput, unknown, CreateSeriesFormOutput>({
    defaultValues: { description: "", name: "", status: "unknown", totalBooks: undefined },
    mode: "onTouched",
    resolver: zodResolver(NewSeriesInputSchema),
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    const description = values.description?.trim();
    const payload: NewSeriesInput = {
      name: values.name,
      status: values.status,
      ...(values.totalBooks === undefined ? {} : { totalBooks: values.totalBooks }),
      ...(description ? { description } : {}),
    };
    createSeries.mutate(payload, {
      onError: (error) =>
        setServerError(
          error instanceof ApiError && error.status === DUPLICATE_STATUS
            ? t("duplicate")
            : t("genericError"),
        ),
      onSuccess: () => {
        toast.success(tToast("created"));
        onDone();
      },
    });
  });

  return (
    <form className="flex flex-col gap-4" noValidate onSubmit={onSubmit}>
      <div className="flex flex-col gap-2">
        <Label htmlFor="new-series-name">{t("name")}</Label>
        <Input
          aria-describedby={errors.name ? "new-series-name-error" : undefined}
          aria-invalid={errors.name !== undefined}
          autoComplete="off"
          className="h-10"
          id="new-series-name"
          maxLength={NAME_MAX}
          placeholder={t("namePlaceholder")}
          {...register("name")}
        />
        <FieldError error={errors.name} id="new-series-name-error" />
      </div>

      <div className="flex flex-col gap-2">
        <Label>{t("status")}</Label>
        <Controller
          control={control}
          name="status"
          render={({ field }) => (
            <ChipGroup
              label={t("status")}
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
        <Label htmlFor="new-series-total-books">
          {t("totalBooks")}{" "}
          <span className="text-xs font-normal text-muted-foreground">{t("optional")}</span>
        </Label>
        <Controller
          control={control}
          name="totalBooks"
          render={({ field }) => (
            <Input
              aria-describedby={errors.totalBooks ? "new-series-total-books-error" : undefined}
              aria-invalid={errors.totalBooks !== undefined}
              autoComplete="off"
              className="h-10 sm:w-40"
              id="new-series-total-books"
              inputMode="numeric"
              max={TOTAL_BOOKS_MAX}
              min={TOTAL_BOOKS_MIN}
              onChange={(event) =>
                field.onChange(event.target.value === "" ? undefined : Number(event.target.value))
              }
              onKeyDown={blockNegativeNumberKeys}
              onPaste={blockNegativeNumberPaste}
              placeholder={t("totalBooksPlaceholder")}
              step={1}
              type="number"
              value={field.value ?? ""}
            />
          )}
        />
        <FieldError error={errors.totalBooks} id="new-series-total-books-error" />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="new-series-description">
          {t("descriptionLabel")}{" "}
          <span className="text-xs font-normal text-muted-foreground">{t("optional")}</span>
        </Label>
        <Controller
          control={control}
          name="description"
          render={({ field }) => (
            <>
              <Textarea
                aria-describedby="new-series-description-counter"
                id="new-series-description"
                maxLength={SERIES_DESCRIPTION_MAX}
                onChange={field.onChange}
                placeholder={t("descriptionPlaceholder")}
                value={field.value ?? ""}
              />
              <span
                className="ml-auto text-xs text-muted-foreground tabular-nums"
                id="new-series-description-counter"
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
          {t("cancel")}
        </Button>
        <Button disabled={createSeries.isPending} loading={createSeries.isPending} type="submit">
          {t("submit")}
        </Button>
      </DialogFooter>
    </form>
  );
}
