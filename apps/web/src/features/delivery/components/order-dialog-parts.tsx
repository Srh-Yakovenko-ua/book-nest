"use client";

import type { useTranslations } from "next-intl";
import type { ReactNode } from "react";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const NOTE_MAX_LENGTH = 300;

export type ManageTranslations = ReturnType<typeof useTranslations<"delivery.manage">>;

export function Field({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      {label}
      <Input onChange={(event) => onChange(event.target.value)} value={value} />
    </label>
  );
}

export function Footer({ loading, t }: { loading: boolean; t: ManageTranslations }) {
  return (
    <DialogFooter>
      <Button loading={loading} type="submit">
        {t("save")}
      </Button>
    </DialogFooter>
  );
}

export function Frame({
  children,
  className,
  description,
  onOpenChange,
  title,
}: {
  children: ReactNode;
  className?: string;
  description: string;
  onOpenChange: (open: boolean) => void;
  title: string;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open>
      <DialogContent className={className}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

export function Labeled({
  children,
  htmlFor,
  label,
}: {
  children: ReactNode;
  htmlFor: string;
  label: string;
}) {
  return (
    <div className="grid gap-1.5 text-sm font-medium">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

export function mutationCallbacks(
  success: string,
  toErrorText: (error: unknown) => string,
  onOpenChange: (open: boolean) => void,
) {
  return {
    onError: (error: Error) => toast.error(toErrorText(error)),
    onSuccess: () => {
      toast.success(success);
      onOpenChange(false);
    },
  };
}
