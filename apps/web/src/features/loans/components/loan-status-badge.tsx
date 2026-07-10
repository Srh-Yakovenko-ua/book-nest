"use client";

import type { LoanUiStatus } from "@app/shared";

import { useTranslations } from "next-intl";

import { StatusBadge } from "@/components/ui/status-badge";

import { LOAN_STATUS_META } from "../model/loans-status";

export function LoanStatusBadge({ status }: { status: LoanUiStatus }) {
  const t = useTranslations("loans.status");
  const meta = LOAN_STATUS_META[status];

  return <StatusBadge entry={{ ...meta, label: t(status), value: status }} />;
}
