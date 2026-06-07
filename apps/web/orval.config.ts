import { defineConfig } from "orval";

const openApiSpec = "../../openapi.json";

export default defineConfig({
  api: {
    hooks: {
      afterAllFilesWrite: "prettier --write",
    },
    input: {
      target: openApiSpec,
    },
    output: {
      clean: true,
      client: "react-query",
      httpClient: "fetch",
      mode: "tags-split",
      override: {
        mutator: {
          name: "customInstance",
          path: "src/shared/api/mutator.ts",
        },
        query: {
          useQuery: true,
        },
      },
      prettier: true,
      schemas: "src/shared/api/generated/model",
      target: "src/shared/api/generated/endpoints",
    },
  },
  zod: {
    hooks: {
      afterAllFilesWrite: "prettier --write",
    },
    input: {
      target: openApiSpec,
    },
    output: {
      clean: true,
      client: "zod",
      fileExtension: ".zod.ts",
      mode: "tags-split",
      override: {
        zod: {
          generate: {
            body: true,
            header: false,
            param: true,
            query: true,
            response: true,
          },
        },
      },
      prettier: true,
      target: "src/shared/api/generated/zod",
    },
  },
});
