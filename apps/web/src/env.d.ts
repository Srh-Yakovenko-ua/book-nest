/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />
import "@total-typescript/ts-reset";

declare global {
  const __APP_VERSION__: string;
  const __DEV__: boolean;
  const __PROD__: boolean;

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }

  interface ImportMetaEnv {
    readonly VITE_API_BASE_URL: string;
  }
}

export {};
