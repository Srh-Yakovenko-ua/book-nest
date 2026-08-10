"use client";

import type { BookStoreLinkView, Nullable, PurchaseInfoView } from "@app/shared";
import type { FieldError as RhfFieldError } from "react-hook-form";

import { useLocale, useTranslations } from "next-intl";

import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatStorePrice } from "@/features/books-to-buy/model/format-store-price";
import {
  blockNegativeNumberKeys,
  blockNegativeNumberPaste,
} from "@/lib/block-negative-number-keys";
import { cn } from "@/lib/utils";

import {
  OTHER_STORE_SOURCE,
  STORE_SOURCE_CURRENCIES,
  type StoreSourceValue,
  toStoreSourcePrice,
} from "../model/store-source";
import { StoreAutocomplete } from "./store-autocomplete";

type StoreSourceErrors = {
  price?: RhfFieldError;
  storeName?: RhfFieldError;
};

type StoreSourceFieldsProps = {
  bestOfferLinkId: Nullable<string>;
  errors: StoreSourceErrors;
  onBlur: () => void;
  onChange: (next: StoreSourceValue) => void;
  purchaseInfo: Nullable<PurchaseInfoView>;
  storeLinks: BookStoreLinkView[];
  value: StoreSourceValue;
};

export function StoreSourceFields({
  bestOfferLinkId,
  errors,
  onBlur,
  onChange,
  purchaseInfo,
  storeLinks,
  value,
}: StoreSourceFieldsProps) {
  const t = useTranslations("books.details.ownership.buyConfirm");
  const tDialog = useTranslations("books.details.ownership.buyDialog");
  const locale = useLocale();
  const selectedLink = storeLinks.find((link) => link.id === value.source) ?? null;

  const selectSource = (source: string) => {
    const link = storeLinks.find((item) => item.id === source) ?? null;
    onChange({ ...value, ...toStoreSourcePrice({ link, purchaseInfo }), source });
  };

  return (
    <>
      {storeLinks.length === 0 ? null : (
        <RadioGroup
          aria-label={t("sourceLegend")}
          onValueChange={selectSource}
          value={value.source}
        >
          {storeLinks.map((link) => (
            <StoreLinkOption
              isBestOffer={link.id === bestOfferLinkId}
              key={link.id}
              link={link}
              locale={locale}
              noPriceLabel={t("linkNoPrice")}
            />
          ))}
          <label
            className="flex cursor-pointer items-center gap-3 rounded-md border border-border bg-card p-3 transition-colors hover:border-accent-border"
            htmlFor="store-source-other"
          >
            <RadioGroupItem id="store-source-other" value={OTHER_STORE_SOURCE} />
            <span className="min-w-0 text-sm text-foreground">{t("sourceOther")}</span>
          </label>
        </RadioGroup>
      )}

      {selectedLink === null ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="store-source-name">{tDialog("storeName")}</Label>
          <StoreAutocomplete
            describedBy={errors.storeName ? "store-source-name-error" : undefined}
            id="store-source-name"
            invalid={errors.storeName !== undefined}
            label={tDialog("storeName")}
            onChange={(next) => onChange({ ...value, storeName: next })}
            placeholder={tDialog("storeNamePlaceholder")}
            value={value.storeName}
          />
          <FieldError error={errors.storeName} id="store-source-name-error" />
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="store-source-price">{t("price")}</Label>
          <Input
            aria-describedby={errors.price ? "store-source-price-error" : undefined}
            aria-invalid={errors.price !== undefined}
            className="h-10"
            id="store-source-price"
            inputMode="decimal"
            min={0}
            onBlur={onBlur}
            onChange={(event) => onChange({ ...value, price: event.target.value })}
            onKeyDown={blockNegativeNumberKeys}
            onPaste={blockNegativeNumberPaste}
            placeholder="0"
            step="0.01"
            type="number"
            value={value.price}
          />
          <FieldError error={errors.price} id="store-source-price-error" />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="store-source-currency">{tDialog("currency")}</Label>
          <div className="w-full sm:w-28">
            <Select
              onValueChange={(currency) =>
                onChange({ ...value, currency: toCurrency(currency, value.currency) })
              }
              value={value.currency}
            >
              <SelectTrigger
                className="h-10 w-full data-[size=default]:h-10"
                id="store-source-currency"
              >
                <SelectValue placeholder={tDialog("currencyPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {STORE_SOURCE_CURRENCIES.map((currency) => (
                  <SelectItem key={currency} value={currency}>
                    {currency}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </>
  );
}

function StoreLinkOption({
  isBestOffer,
  link,
  locale,
  noPriceLabel,
}: {
  isBestOffer: boolean;
  link: BookStoreLinkView;
  locale: string;
  noPriceLabel: string;
}) {
  const optionId = `store-source-${link.id}`;

  return (
    <label
      className="flex cursor-pointer items-center gap-3 rounded-md border border-border bg-card p-3 transition-colors hover:border-accent-border"
      htmlFor={optionId}
    >
      <RadioGroupItem id={optionId} value={link.id} />
      <span className="min-w-0 flex-1 truncate text-sm text-foreground">{link.storeName}</span>
      <span
        className={cn(
          "shrink-0 text-sm tabular-nums",
          isBestOffer ? "font-semibold text-success" : "text-muted-foreground",
        )}
      >
        {link.price === null
          ? noPriceLabel
          : formatStorePrice({ currency: link.currency, locale, price: link.price })}
      </span>
    </label>
  );
}

function toCurrency(
  next: string,
  fallback: StoreSourceValue["currency"],
): StoreSourceValue["currency"] {
  return STORE_SOURCE_CURRENCIES.find((currency) => currency === next) ?? fallback;
}
