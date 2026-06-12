import * as React from "react";

import { UiIcon } from "@/components/icons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type CharacterCardProps = Omit<React.ComponentProps<"article">, "role" | "title"> & {
  actions?: React.ReactNode;
  avatar?: { alt?: string; src: string };
  bookTitle?: string;
  description?: string;
  name: string;
  role?: CharacterRole;
  traits?: readonly string[];
};

type CharacterRole = {
  label: string;
  variant?: React.ComponentProps<typeof Badge>["variant"];
};

function CharacterCard({
  actions,
  avatar,
  bookTitle,
  className,
  description,
  name,
  role,
  traits,
  ...props
}: CharacterCardProps) {
  return (
    <article
      className={cn(
        "flex flex-col rounded-xl border border-border bg-card p-5 text-card-foreground shadow-card transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-hover motion-reduce:transition-none",
        className,
      )}
      data-slot="character-card"
      {...props}
    >
      <div className="flex items-start gap-3.5">
        <Avatar
          className="size-14 bg-gradient-to-br from-accent-border to-primary text-primary-foreground"
          size="lg"
        >
          {avatar === undefined ? null : <AvatarImage alt={avatar.alt ?? name} src={avatar.src} />}
          <AvatarFallback className="bg-transparent font-heading text-xl font-bold text-primary-foreground">
            {initial(name)}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <h3 className="font-heading text-xl leading-tight text-ink">{name}</h3>
          {role === undefined ? null : (
            <Badge className="mt-1.5" variant={role.variant ?? "secondary"}>
              {role.label}
            </Badge>
          )}
        </div>

        {actions === undefined ? null : (
          <div className="-mr-1.5 flex shrink-0 items-center gap-0.5">{actions}</div>
        )}
      </div>

      {bookTitle === undefined ? null : (
        <p className="mt-4 flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground">
          <UiIcon className="shrink-0 text-icon" name="book" size={15} />
          <span className="min-w-0 truncate">з книги «{bookTitle}»</span>
        </p>
      )}

      {description === undefined ? null : (
        <p className="mt-3 text-sm leading-relaxed text-foreground">{description}</p>
      )}

      {traits === undefined || traits.length === 0 ? null : (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {traits.map((trait) => (
            <span
              className="rounded-full border border-border bg-secondary px-2.5 py-1 text-xs font-medium text-foreground/85"
              key={trait}
            >
              {trait}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}

function initial(name: string) {
  return name.trim().charAt(0).toUpperCase();
}

export { CharacterCard };
