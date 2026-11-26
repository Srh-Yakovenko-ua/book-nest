"use client";

import { LogOut, UserPen } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useLogout, useSession } from "@/features/auth";
import { ProfileEditDialog } from "@/features/profile";
import { Link } from "@/i18n/navigation";
import { initials } from "@/lib/initials";

export function SessionMenu() {
  const { status, user } = useSession();

  if (status === "loading") {
    return <Skeleton className="size-8 rounded-full" />;
  }

  if (status === "unauthenticated" || !user) {
    return <SignedOut />;
  }

  return <SignedIn email={user.email} name={user.name} />;
}

function SignedIn({ email, name }: { email: string; name: string }) {
  const t = useTranslations("auth");
  const tProfile = useTranslations("profile");
  const logout = useLogout();
  const [isProfileEditOpen, setProfileEditOpen] = useState(false);
  const accountMenuTriggerRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={t("session.accountMenu")}
            className="size-9 rounded-full p-0 hover:bg-muted"
            ref={accountMenuTriggerRef}
            size="icon"
            variant="ghost"
          >
            <Avatar>
              <AvatarFallback className="bg-primary/12 text-xs font-semibold text-primary">
                {initials(name)}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          <DropdownMenuLabel className="flex flex-col gap-0.5 py-1.5">
            <span className="truncate text-sm font-medium text-foreground">{name}</span>
            <span className="truncate text-xs font-normal text-muted-foreground">{email}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setProfileEditOpen(true)}>
            <UserPen className="mr-2" />
            {tProfile("editAction")}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={logout.isPending}
            onSelect={(event) => {
              event.preventDefault();
              logout.mutate();
            }}
            variant="destructive"
          >
            <LogOut className="mr-2" />
            {logout.isPending ? t("session.signingOut") : t("session.signOut")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ProfileEditDialog
        onOpenChange={setProfileEditOpen}
        open={isProfileEditOpen}
        returnFocusRef={accountMenuTriggerRef}
      />
    </>
  );
}

function SignedOut() {
  const t = useTranslations("auth");

  return (
    <div className="flex items-center gap-1.5">
      <Button asChild size="sm" variant="ghost">
        <Link href="/register">{t("register.cta")}</Link>
      </Button>
      <Button asChild size="sm">
        <Link href="/login">{t("login.cta")}</Link>
      </Button>
    </div>
  );
}
