"use client";

import type { Nullable } from "@app/shared";
import type { RefObject } from "react";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { DiscardChangesDialog } from "@/components/discard-changes-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useCloseGuard } from "@/hooks/use-close-guard";

import { useProfile } from "../api/use-profile";
import { useUpdateProfile } from "../api/use-update-profile";
import { ProfileEditForm } from "./profile-edit-form";
import { ProfileLoadError } from "./profile-load-error";

type ProfileEditDialogProps = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  returnFocusRef: RefObject<Nullable<HTMLElement>>;
};

export function ProfileEditDialog({ onOpenChange, open, returnFocusRef }: ProfileEditDialogProps) {
  const t = useTranslations("profile.dialog");
  const updateProfile = useUpdateProfile();
  const [isDraftDirty, setDraftDirty] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  function close() {
    setDraftDirty(false);
    onOpenChange(false);
  }

  const guard = useCloseGuard({
    focusFallback: () => contentRef.current?.focus(),
    isDirty: isDraftDirty,
    isOpen: open,
    isPending: updateProfile.isPending,
    onClose: close,
  });

  function returnFocusToEntryPoint(event: Event) {
    const entryPoint = returnFocusRef.current;
    if (entryPoint === null || !entryPoint.isConnected) return;
    event.preventDefault();
    entryPoint.focus();
  }

  function keepFocusInside(event: Event) {
    event.preventDefault();
    const content = contentRef.current;
    if (content === null || content.contains(document.activeElement)) return;
    content.focus();
  }

  return (
    <>
      <Dialog
        onOpenChange={(next) => {
          if (!next) guard.requestClose();
        }}
        open={open}
      >
        <DialogContent
          className="flex max-h-9/10 flex-col overflow-hidden sm:max-w-md"
          closeLabel={t("close")}
          onCloseAutoFocus={returnFocusToEntryPoint}
          onOpenAutoFocus={keepFocusInside}
          ref={contentRef}
        >
          <DialogHeader className="shrink-0 pr-8">
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription className="sr-only">{t("description")}</DialogDescription>
          </DialogHeader>
          <ProfileEditBody
            onCancel={guard.requestClose}
            onDirtyChange={setDraftDirty}
            onSaved={close}
            updateProfile={updateProfile}
          />
        </DialogContent>
      </Dialog>

      <DiscardChangesDialog {...guard.discardDialog} />
    </>
  );
}

function ProfileEditBody({
  onCancel,
  onDirtyChange,
  onSaved,
  updateProfile,
}: {
  onCancel: () => void;
  onDirtyChange: (isDirty: boolean) => void;
  onSaved: () => void;
  updateProfile: ReturnType<typeof useUpdateProfile>;
}) {
  const profile = useProfile();

  if (profile.data !== undefined) {
    return (
      <ProfileEditForm
        onCancel={onCancel}
        onDirtyChange={onDirtyChange}
        onSaved={onSaved}
        profile={profile.data}
        updateProfile={updateProfile}
      />
    );
  }

  if (profile.isError) return <ProfileLoadError onRetry={() => void profile.refetch()} />;

  return <ProfileEditSkeleton />;
}

function ProfileEditSkeleton() {
  const t = useTranslations("profile");

  return (
    <div className="flex flex-col gap-4" role="status">
      <span className="sr-only">{t("loading")}</span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-8 w-full" />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-full" />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-20 w-full" />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-48" />
      </div>
    </div>
  );
}
