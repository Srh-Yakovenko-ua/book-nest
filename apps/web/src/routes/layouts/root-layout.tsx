import { Outlet } from "react-router";

import { RouteProgress } from "@/components/route-progress";

export function RootLayout() {
  return (
    <>
      <RouteProgress />
      <Outlet />
    </>
  );
}
