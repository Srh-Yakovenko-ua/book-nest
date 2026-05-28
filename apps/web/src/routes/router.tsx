import type { RouteObject } from "react-router";

import { createBrowserRouter } from "react-router";

import { AppErrorBoundary } from "@/routes/error-boundary";
import { AppShell } from "@/routes/layouts/app-shell";
import { RootLayout } from "@/routes/layouts/root-layout";
import { lazyComponent } from "@/routes/lazy";
import { ROUTES } from "@/routes/paths";

const homeRoute: RouteObject = {
  index: true,
  lazy: lazyComponent(() => import("@/routes/home-page"), "HomePage"),
};

const notFoundRoute: RouteObject = {
  lazy: lazyComponent(() => import("@/routes/not-found-page"), "NotFoundPage"),
  path: ROUTES.NOT_FOUND,
};

const appShellRoute: RouteObject = {
  children: [homeRoute, notFoundRoute],
  element: <AppShell />,
  errorElement: <AppErrorBoundary />,
  path: ROUTES.ROOT,
};

export const router = createBrowserRouter([
  {
    children: [appShellRoute],
    element: <RootLayout />,
  },
]);
