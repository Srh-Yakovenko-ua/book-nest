"use client";

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { UiIcon } from "@/components/icons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useIsTextClamped } from "@/hooks/use-is-text-clamped";
import { cn } from "@/lib/utils";

const characterCardVariants = cva(
  "flex flex-col rounded-xl border border-border bg-card text-card-foreground shadow-card transition-[box-shadow,border-color] duration-200 ease-out motion-reduce:transition-none",
  {
    variants: {
      density: {
        compact: "p-4",
        default: "p-5",
      },
      linked: {
        false: "",
        true: "relative focus-within:border-accent-border focus-within:shadow-hover hover:border-accent-border hover:shadow-hover",
      },
    },
    defaultVariants: {
      density: "default",
      linked: false,
    },
  },
);

type CharacterCardDensity = NonNullable<VariantProps<typeof characterCardVariants>["density"]>;

const DENSITY_SLOTS = {
  compact: {
    actions: "-mr-1",
    header: "gap-3",
  },
  default: {
    actions: "-mr-1.5",
    header: "gap-3.5",
  },
} as const satisfies Record<CharacterCardDensity, Record<string, string>>;

type CharacterCardLink = {
  component: "a" | CharacterCardLinkComponent;
  href: string;
};

type CharacterCardLinkComponent = React.ComponentType<{
  children?: React.ReactNode;
  className?: string;
  href: string;
}>;

type CharacterCardProps = Omit<React.ComponentProps<"article">, "role" | "title"> & {
  actions?: React.ReactNode;
  avatar?: { alt?: string; src: string };
  bookTitle?: string;
  density?: CharacterCardDensity;
  description?: string;
  href?: string;
  linkComponent?: CharacterCardLinkComponent;
  meta?: React.ReactNode;
  name: string;
  role?: CharacterRole;
  secondaryName?: string;
  traits?: readonly string[];
};

type CharacterRole = {
  label: string;
  variant?: React.ComponentProps<typeof Badge>["variant"];
};

function CardNameLink({
  children,
  link,
}: {
  children: React.ReactNode;
  link: CharacterCardLink | undefined;
}) {
  if (link === undefined) return children;

  const LinkComp = link.component;
  return (
    <LinkComp
      className="text-ink no-underline outline-none before:absolute before:inset-0 before:rounded-xl focus-visible:before:ring-3 focus-visible:before:ring-ring"
      href={link.href}
    >
      {children}
    </LinkComp>
  );
}

function CharacterCard({
  actions,
  avatar,
  bookTitle,
  className,
  density = "default",
  description,
  href,
  linkComponent,
  meta,
  name,
  role,
  secondaryName,
  traits,
  ...props
}: CharacterCardProps) {
  const link: CharacterCardLink | undefined =
    href === undefined ? undefined : { component: linkComponent ?? "a", href };
  const slots = DENSITY_SLOTS[density];
  const hasTraits = traits !== undefined && traits.length > 0;
  const hasMetadata = role !== undefined || hasTraits || meta !== undefined;

  return (
    <article
      className={cn(characterCardVariants({ density, linked: link !== undefined }), className)}
      data-slot="character-card"
      {...props}
    >
      <div className={cn("flex items-start", slots.header)}>
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
          {density === "compact" ? (
            <ClampedCardName link={link} name={name} />
          ) : (
            <h3 className="font-heading text-xl leading-tight text-ink">
              <CardNameLink link={link}>{name}</CardNameLink>
            </h3>
          )}

          {secondaryName === undefined ? null : (
            <p className="mt-0.5 line-clamp-1 text-[0.8125rem] leading-snug wrap-anywhere text-muted-foreground">
              {secondaryName}
            </p>
          )}

          {density === "compact" && hasMetadata ? (
            <CompactMetadata meta={meta} role={role} traits={traits} />
          ) : null}

          {density === "default" && role !== undefined ? (
            <Badge className="mt-1.5" variant={role.variant ?? "secondary"}>
              {role.label}
            </Badge>
          ) : null}
        </div>

        {actions === undefined ? null : (
          <div
            className={cn(
              slots.actions,
              "flex shrink-0 items-center gap-0.5",
              link !== undefined && "relative z-10",
            )}
          >
            {actions}
          </div>
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

      {density === "default" && (hasTraits || meta !== undefined) ? (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {traits?.map((trait) => (
            <span
              className="rounded-full border border-border bg-secondary px-2.5 py-1 text-xs font-medium text-foreground/85"
              key={trait}
            >
              {trait}
            </span>
          ))}
          {meta}
        </div>
      ) : null}
    </article>
  );
}

function ClampedCardName({ link, name }: { link: CharacterCardLink | undefined; name: string }) {
  const { isClamped, ref } = useIsTextClamped<HTMLSpanElement>(name);
  const [isNameRevealed, setIsNameRevealed] = React.useState(false);

  function revealOnKeyboardFocus(event: React.FocusEvent) {
    if (event.target.matches(":focus-visible")) setIsNameRevealed(true);
  }

  function revealOnlyWhenClamped(open: boolean) {
    setIsNameRevealed(open && isClamped);
  }

  return (
    <h3
      className="font-heading text-[1.0625rem] leading-tight text-ink"
      onBlur={() => setIsNameRevealed(false)}
      onFocus={revealOnKeyboardFocus}
    >
      <CardNameLink link={link}>
        <Tooltip onOpenChange={revealOnlyWhenClamped} open={isClamped && isNameRevealed}>
          <TooltipTrigger asChild>
            <span className="relative line-clamp-2 wrap-anywhere" ref={ref}>
              {name}
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-80 break-words">{name}</TooltipContent>
        </Tooltip>
      </CardNameLink>
    </h3>
  );
}

function CompactMetadata({
  meta,
  role,
  traits,
}: Pick<CharacterCardProps, "meta" | "role" | "traits">) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1">
      {role === undefined ? null : (
        <Badge variant={role.variant ?? "secondary"}>{role.label}</Badge>
      )}
      {traits?.map((trait) => (
        <span
          className="inline-flex h-5 items-center rounded-full border border-border bg-secondary px-2 text-xs font-medium text-foreground/85"
          key={trait}
        >
          {trait}
        </span>
      ))}
      {meta}
    </div>
  );
}

function initial(name: string) {
  return name.trim().charAt(0).toUpperCase();
}

export { CharacterCard };
