"use client";

import type { LibraryPublisherDetail, Nullable, UpdatePublisherInput } from "@app/shared";

import {
  PublisherCountryCodeSchema,
  PublisherFoundedYearSchema,
  PublisherWebsiteUrlSchema,
  TaxonomyNameSchema,
} from "@app/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { CountrySelect } from "@/components/country-select";
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
import { YearPicker } from "@/components/ui/year-picker";
import { DiscardConfirmDialog } from "@/features/books";
import { ApiError } from "@/lib/http-client";

import { useUpdatePublisher } from "../api/use-update-publisher";

const EDIT_PUBLISHER_FORM = {
  duplicateStatus: 409,
  foundedYearMax: 2100,
  foundedYearMin: 1400,
  websiteMaxLength: 300,
} as const;

type EditPublisherDialogProps = {
  details: LibraryPublisherDetail;
  onCloseAutoFocus: (event: Event) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

type EditPublisherFormValues = {
  countryCode: Nullable<string>;
  foundedYear: Nullable<number>;
  name: string;
  websiteUrl: string;
};

export function EditPublisherDialog({
  details,
  onCloseAutoFocus,
  onOpenChange,
  open,
}: EditPublisherDialogProps) {
  const t = useTranslations("publishers.details.editDialog");
  const [dirty, setDirty] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  function requestClose() {
    if (dirty) {
      setDiscardOpen(true);
      return;
    }
    onOpenChange(false);
  }

  return (
    <>
      <Dialog
        onOpenChange={(next) => {
          if (next) {
            onOpenChange(true);
            return;
          }
          requestClose();
        }}
        open={open}
      >
        <DialogContent
          className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md"
          onCloseAutoFocus={onCloseAutoFocus}
        >
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>
          {open ? (
            <EditPublisherForm
              details={details}
              onCancel={requestClose}
              onDirtyChange={setDirty}
              onDone={() => {
                setDirty(false);
                onOpenChange(false);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
      <DiscardConfirmDialog
        description={t("discardDescription")}
        onConfirm={() => {
          setDiscardOpen(false);
          setDirty(false);
          onOpenChange(false);
        }}
        onOpenChange={setDiscardOpen}
        open={discardOpen}
        title={t("discardTitle")}
      />
    </>
  );
}

function EditPublisherForm({
  details,
  onCancel,
  onDirtyChange,
  onDone,
}: {
  details: LibraryPublisherDetail;
  onCancel: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onDone: () => void;
}) {
  const t = useTranslations("publishers.details.editDialog");
  const tYearPicker = useTranslations("books.library.filters.yearPicker");
  const tToast = useTranslations("publishers.details.toast");
  const updatePublisher = useUpdatePublisher(details.id);
  const [serverError, setServerError] = useState<Nullable<string>>(null);

  const formSchema = z.object({
    countryCode: z.string().nullable(),
    foundedYear: z
      .number()
      .nullable()
      .refine((year) => year === null || PublisherFoundedYearSchema.safeParse(year).success, {
        message: t("invalidYear"),
      }),
    name: z.string().refine((value) => TaxonomyNameSchema.safeParse(value).success, {
      message: t("invalidName"),
    }),
    websiteUrl: z
      .string()
      .refine(
        (value) => value.trim() === "" || PublisherWebsiteUrlSchema.safeParse(value).success,
        {
          message: t("invalidUrl"),
        },
      ),
  });

  const {
    control,
    formState: { dirtyFields, errors, isDirty },
    handleSubmit,
    register,
    setError,
  } = useForm<EditPublisherFormValues>({
    defaultValues: {
      countryCode: details.countryCode,
      foundedYear: details.foundedYear,
      name: details.name,
      websiteUrl: details.websiteUrl ?? "",
    },
    mode: "onTouched",
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);

  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    const payload: UpdatePublisherInput = {
      foundedYear: values.foundedYear,
      name: TaxonomyNameSchema.parse(values.name),
      websiteUrl:
        values.websiteUrl.trim() === "" ? null : PublisherWebsiteUrlSchema.parse(values.websiteUrl),
      ...(dirtyFields.countryCode === true
        ? {
            countryCode:
              values.countryCode === null
                ? null
                : PublisherCountryCodeSchema.parse(values.countryCode),
          }
        : {}),
    };

    updatePublisher.mutate(payload, {
      onError: (error) => {
        if (error instanceof ApiError && error.status === EDIT_PUBLISHER_FORM.duplicateStatus) {
          setError("name", { message: t("duplicate") });
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
        <Label htmlFor="edit-publisher-name">{t("name")}</Label>
        <Input
          aria-describedby={errors.name ? "edit-publisher-name-error" : undefined}
          aria-invalid={errors.name !== undefined}
          autoComplete="off"
          className="h-10"
          id="edit-publisher-name"
          placeholder={t("namePlaceholder")}
          {...register("name")}
        />
        <FieldError error={errors.name} id="edit-publisher-name-error" />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="edit-publisher-country">
          {t("country")}{" "}
          <span className="text-xs font-normal text-muted-foreground">{t("optional")}</span>
        </Label>
        <Controller
          control={control}
          name="countryCode"
          render={({ field }) => (
            <CountrySelect
              id="edit-publisher-country"
              labels={{
                clear: t("countryClear"),
                empty: t("countryEmpty"),
                placeholder: t("countryPlaceholder"),
                search: t("countrySearch"),
              }}
              onChange={field.onChange}
              value={field.value}
            />
          )}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="edit-publisher-website">
          {t("website")}{" "}
          <span className="text-xs font-normal text-muted-foreground">{t("optional")}</span>
        </Label>
        <Input
          aria-describedby={errors.websiteUrl ? "edit-publisher-website-error" : undefined}
          aria-invalid={errors.websiteUrl !== undefined}
          autoComplete="off"
          className="h-10"
          id="edit-publisher-website"
          inputMode="url"
          maxLength={EDIT_PUBLISHER_FORM.websiteMaxLength}
          placeholder={t("websitePlaceholder")}
          {...register("websiteUrl")}
        />
        <FieldError error={errors.websiteUrl} id="edit-publisher-website-error" />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="edit-publisher-founded">
          {t("foundedYear")}{" "}
          <span className="text-xs font-normal text-muted-foreground">{t("optional")}</span>
        </Label>
        <Controller
          control={control}
          name="foundedYear"
          render={({ field }) => (
            <YearPicker
              ariaLabel={t("foundedYear")}
              clearLabel={tYearPicker("clear")}
              id="edit-publisher-founded"
              invalid={errors.foundedYear !== undefined}
              max={EDIT_PUBLISHER_FORM.foundedYearMax}
              min={EDIT_PUBLISHER_FORM.foundedYearMin}
              nextLabel={tYearPicker("next")}
              onChange={field.onChange}
              placeholder={t("foundedYearPlaceholder")}
              prevLabel={tYearPicker("prev")}
              value={field.value}
            />
          )}
        />
        <FieldError error={errors.foundedYear} id="edit-publisher-founded-error" />
      </div>

      {serverError === null ? null : (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {serverError}
        </p>
      )}

      <DialogFooter>
        <Button onClick={onCancel} type="button" variant="secondary">
          {t("cancel")}
        </Button>
        <Button
          disabled={updatePublisher.isPending}
          loading={updatePublisher.isPending}
          type="submit"
        >
          {t("submit")}
        </Button>
      </DialogFooter>
    </form>
  );
}
