import type { ReactNode } from "react";

import { UiIcon } from "@/components/icons";
import { Link } from "@/i18n/navigation";

type HomeHeaderLinkProps = {
  children: ReactNode;
  href: string;
};

export function HomeHeaderLink({ children, href }: HomeHeaderLinkProps) {
  return (
    <Link
      className="flex shrink-0 cursor-pointer items-center gap-1 rounded-md text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
      href={href}
    >
      {children}
      <UiIcon aria-hidden name="arrow-right" size={16} />
    </Link>
  );
}
