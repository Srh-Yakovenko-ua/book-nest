"use client";

import type { LibraryPublisherDetail, UpdatePublisherInput } from "@app/shared";

import {
  PublisherCountryCodeSchema,
  PublisherFoundedYearSchema,
  PublisherWebsiteUrlSchema,
  TaxonomyNameSchema,
} from "@app/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

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
import { DiscardConfirmDialog } from "@/features/books";
import {
  blockNegativeNumberKeys,
  blockNegativeNumberPaste,
} from "@/lib/block-negative-number-keys";
import { ApiError } from "@/lib/http-client";

import { useUpdatePublisher } from "../api/use-update-publisher";

const DUPLICATE_STATUS = 409;
const UNPROCESSABLE_STATUS = 422;
const COUNTRY_CODE_LENGTH = 2;
const WEBSITE_MAX = 300;

type EditPublisherDialogProps = {
  details: LibraryPublisherDetail;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

type EditPublisherFormValues = {
  countryCode: string;
  foundedYear: string;
  name: string;
  websiteUrl: string;
};

export function EditPublisherDialog({ details, onOpenChange, open }: EditPublisherDialogProps) {
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
        <DialogContent className="sm:max-w-md">
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
  const tToast = useTranslations("publishers.details.toast");
  const updatePublisher = useUpdatePublisher(details.id);
  const [serverError, setServerError] = useState<null | string>(null);

  const formSchema = z.object({
    countryCode: z
      .string()
      .refine(
        (value) => value.trim() === "" || PublisherCountryCodeSchema.safeParse(value).success,
        {
          message: t("invalidCountry"),
        },
      ),
    foundedYear: z
      .string()
      .refine(
        (value) =>
          value.trim() === "" || PublisherFoundedYearSchema.safeParse(Number(value)).success,
        { message: t("invalidYear") },
      ),
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
    formState: { errors, isDirty },
    handleSubmit,
    register,
    setError,
  } = useForm<EditPublisherFormValues>({
    defaultValues: {
      countryCode: details.countryCode ?? "",
      foundedYear: details.foundedYear === null ? "" : String(details.foundedYear),
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
      countryCode:
        values.countryCode.trim() === ""
          ? null
          : PublisherCountryCodeSchema.parse(values.countryCode),
      foundedYear: values.foundedYear.trim() === "" ? null : Number(values.foundedYear),
      name: TaxonomyNameSchema.parse(values.name),
      websiteUrl:
        values.websiteUrl.trim() === "" ? null : PublisherWebsiteUrlSchema.parse(values.websiteUrl),
    };

    updatePublisher.mutate(payload, {
      onError: (error) => {
        if (error instanceof ApiError && error.status === DUPLICATE_STATUS) {
          setError("name", { message: t("duplicate") });
          return;
        }
        if (error instanceof ApiError && error.status === UNPROCESSABLE_STATUS) {
          setServerError(t("genericError"));
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
          {t("countryCode")}{" "}
          <span className="text-xs font-normal text-muted-foreground">{t("optional")}</span>
        </Label>
        <Input
          aria-describedby={errors.countryCode ? "edit-publisher-country-error" : undefined}
          aria-invalid={errors.countryCode !== undefined}
          autoComplete="off"
          className="h-10 uppercase sm:w-32"
          id="edit-publisher-country"
          maxLength={COUNTRY_CODE_LENGTH}
          placeholder={t("countryCodePlaceholder")}
          {...register("countryCode")}
        />
        <FieldError error={errors.countryCode} id="edit-publisher-country-error" />
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
          maxLength={WEBSITE_MAX}
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
        <Input
          aria-describedby={errors.foundedYear ? "edit-publisher-founded-error" : undefined}
          aria-invalid={errors.foundedYear !== undefined}
          autoComplete="off"
          className="h-10 sm:w-40"
          id="edit-publisher-founded"
          inputMode="numeric"
          onKeyDown={blockNegativeNumberKeys}
          onPaste={blockNegativeNumberPaste}
          placeholder={t("foundedYearPlaceholder")}
          type="number"
          {...register("foundedYear")}
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
