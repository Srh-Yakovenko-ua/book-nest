"use client";

import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";

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
import { Link } from "@/i18n/navigation";

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

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.charAt(0) ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? "") : "";
  return (first + last).toUpperCase();
}

function SignedIn({ email, name }: { email: string; name: string }) {
  const t = useTranslations("auth");
  const logout = useLogout();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={t("session.accountMenu")}
          className="size-9 rounded-full p-0 hover:bg-muted"
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
