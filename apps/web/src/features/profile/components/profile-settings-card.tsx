"use client";

import type { ProfileView } from "@app/shared";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { initials } from "@/lib/initials";

import { useProfile } from "../api/use-profile";
import { profileDisplayName } from "../model/profile-display-name";
import { ProfileEditDialog } from "./profile-edit-dialog";
import { ProfileLoadError } from "./profile-load-error";

export function ProfileSettingsCard() {
  const t = useTranslations("profile.card");

  return (
    <Card className="gap-5">
      <CardHeader>
        <CardTitle asChild>
          <h2>{t("title")}</h2>
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <ProfileCardBody />
      </CardContent>
    </Card>
  );
}

function ProfileCardBody() {
  const profile = useProfile();

  if (profile.data !== undefined) return <ProfileSummary profile={profile.data} />;
  if (profile.isError) return <ProfileLoadError onRetry={() => void profile.refetch()} />;

  return <ProfileSummarySkeleton />;
}

function ProfileSummary({ profile }: { profile: ProfileView }) {
  const t = useTranslations("profile");
  const [isEditOpen, setEditOpen] = useState(false);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const displayName = profileDisplayName(profile);
  const showsEmail = profile.email !== "" && profile.email !== displayName;

  return (
    <div className="flex items-center gap-4 sm:gap-5">
      <Avatar aria-hidden className="size-16 sm:size-20">
        {profile.avatarUrl === null ? null : <AvatarImage alt="" src={profile.avatarUrl} />}
        <AvatarFallback className="bg-primary/12 font-heading text-2xl font-semibold text-primary sm:text-3xl">
          {initials(displayName)}
        </AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
        <p className="max-w-full truncate font-heading text-xl font-semibold text-ink">
          {displayName}
        </p>
        {showsEmail ? (
          <p className="max-w-full truncate text-sm text-muted-foreground">{profile.email}</p>
        ) : null}
        <Button
          className="mt-2"
          onClick={() => setEditOpen(true)}
          ref={editButtonRef}
          type="button"
          variant="outline"
        >
          {t("editAction")}
        </Button>
      </div>
      <ProfileEditDialog
        onOpenChange={setEditOpen}
        open={isEditOpen}
        returnFocusRef={editButtonRef}
      />
    </div>
  );
}

function ProfileSummarySkeleton() {
  const t = useTranslations("profile");

  return (
    <div className="flex items-center gap-4 sm:gap-5" role="status">
      <span className="sr-only">{t("loading")}</span>
      <Skeleton className="size-16 shrink-0 rounded-full sm:size-20" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Skeleton className="h-6 w-40 max-w-full" />
        <Skeleton className="h-4 w-56 max-w-full" />
        <Skeleton className="mt-1 h-8 w-40" />
      </div>
    </div>
  );
}
