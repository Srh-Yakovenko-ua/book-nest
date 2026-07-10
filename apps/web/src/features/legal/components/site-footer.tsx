import { getYear } from "date-fns";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

const FOOTER_LINK_CLASS =
  "text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline";

export function SiteFooter() {
  const t = useTranslations("legal.footer");
  const year = getYear(new Date()).toString();

  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex w-full max-w-prose flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="text-xs text-muted-foreground">{t("copyright", { year })}</p>
        <nav aria-label={t("navLabel")}>
          <ul className="flex items-center gap-6">
            <li>
              <Link className={FOOTER_LINK_CLASS} href="/privacy">
                {t("privacy")}
              </Link>
            </li>
            <li>
              <Link className={FOOTER_LINK_CLASS} href="/terms">
                {t("terms")}
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
