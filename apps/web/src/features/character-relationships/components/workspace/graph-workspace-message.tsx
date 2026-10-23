"use client";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

type GraphWorkspaceMessageProps = {
  action?: { label: string; onClick: () => void };
  description: string;
  link?: { href: string; label: string };
  title: string;
};

export function GraphWorkspaceMessage({
  action,
  description,
  link,
  title,
}: GraphWorkspaceMessageProps) {
  return (
    <div
      className="mx-auto flex max-w-md flex-col items-center gap-3 px-6 py-10 text-center"
      role="status"
    >
      <h2 className="font-heading text-lg font-medium">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
      {action === undefined && link === undefined ? null : (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {action === undefined ? null : (
            <Button onClick={action.onClick} type="button">
              {action.label}
            </Button>
          )}
          {link === undefined ? null : (
            <Button asChild variant="outline">
              <Link href={link.href}>{link.label}</Link>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
