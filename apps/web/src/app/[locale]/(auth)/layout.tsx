import type { ReactNode } from "react";

import { GuestGuard } from "@/features/auth";

export default function AuthAreaLayout({ children }: { children: ReactNode }) {
  return <GuestGuard>{children}</GuestGuard>;
}
