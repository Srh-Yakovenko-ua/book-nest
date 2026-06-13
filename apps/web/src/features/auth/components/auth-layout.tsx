import type { ReactNode } from "react";

import { Logo } from "@/components/brand";
import { ThemePicker } from "@/components/theme-picker";

type AuthLayoutProps = {
  children: ReactNode;
  cover: string;
  tagline: string;
};

export function AuthLayout({ children, cover, tagline }: AuthLayoutProps) {
  return (
    <div className="min-h-svh bg-background min-[900px]:grid min-[900px]:grid-cols-2">
      <main className="relative flex min-h-svh flex-col overflow-y-auto px-4 pt-5 pb-8 min-[900px]:px-10 min-[900px]:pt-7 min-[900px]:pb-10 sm:px-6">
        <header className="mb-1.5 flex items-center justify-between">
          <Logo variant="horizontal" />
          <ThemePicker triggerClassName="size-11 rounded-full border border-border bg-card text-foreground hover:bg-secondary [&_svg]:size-4.5" />
        </header>

        <div className="flex flex-1 flex-col items-center justify-center py-4">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </main>

      <aside
        aria-hidden
        className="relative hidden overflow-hidden bg-cover bg-center min-[900px]:block"
        style={{ backgroundImage: `url(${cover})` }}
      >
        <div className="absolute inset-0 bg-[image:var(--auth-cover-scrim)]" />
        <div className="absolute inset-x-0 bottom-0 p-11">
          <div className="flex items-center gap-2.5 font-heading text-2xl font-bold text-white">
            <Logo className="text-white" variant="mark" />
            Book Nest
          </div>
          <p className="mt-4 max-w-[18ch] font-heading text-2xl leading-snug text-white/90 italic">
            {tagline}
          </p>
        </div>
      </aside>
    </div>
  );
}
