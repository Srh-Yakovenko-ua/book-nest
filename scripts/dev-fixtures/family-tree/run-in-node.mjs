import { readFile } from "node:fs/promises";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";

import { runFamilyTreeImport } from "./family-tree-import.mjs";

const CLI_SETTINGS = {
  allowedOrigins: [
    "http://127.0.0.1:3000",
    "http://127.0.0.1:4000",
    "http://localhost:3000",
    "http://localhost:4000",
    "https://dev.book-nest.net",
  ],
  applyFlag: "--apply",
  fixtureFile: "asoiaf-targaryen-genealogy.json",
  forbiddenHostMarkers: ["prod", "stage", "staging"],
  requestTimeoutMs: 30000,
  successStatuses: ["completed", "ok"],
};

function createRequest({ origin, token }) {
  return async (method, path, body) => {
    if (typeof path !== "string" || !path.startsWith("/api/")) {
      throw new Error(`refusing a request outside /api: ${String(path)}`);
    }
    const url = new URL(path, origin);
    if (url.origin !== origin) {
      throw new Error(`refusing a request to another origin: ${url.origin}`);
    }
    const headers = { accept: "application/json", authorization: `Bearer ${token}` };
    const response = await globalThis.fetch(url, {
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: body === undefined ? headers : { ...headers, "content-type": "application/json" },
      method,
      redirect: "error",
      signal: globalThis.AbortSignal.timeout(CLI_SETTINGS.requestTimeoutMs),
    });
    const payload = parseJson(await response.text());
    if (!response.ok) {
      const reason = payload?.message ?? response.statusText;
      const error = new Error(`${method} ${url.pathname} -> ${response.status} ${String(reason)}`);
      error.status = response.status;
      error.code = payload?.code;
      error.body = payload;
      throw error;
    }
    return payload;
  };
}

async function main() {
  const { apply } = parseArguments(process.argv.slice(2));
  const origin = resolveApiOrigin(process.env.BOOKNEST_API_URL);
  const token = process.env.BOOKNEST_ACCESS_TOKEN?.trim() ?? "";
  if (token.length === 0) {
    throw new Error("BOOKNEST_ACCESS_TOKEN is not set");
  }
  const request = createRequest({ origin, token });

  writeLine(`target: ${origin}`);
  writeLine(`mode: ${apply ? "apply" : "dry-run"}`);
  const health = await request("GET", "/api/health");
  writeLine(`health: ${JSON.stringify(health)}`);
  if (apply && health?.postgres !== "ok") {
    throw new Error("refusing to apply: the API reports postgres is not ok");
  }

  const fixture = await readFixture();
  const result = await runFamilyTreeImport({
    apply,
    fixture,
    onProgress: (message) => writeLine(`  ${message}`),
    request,
  });
  writeLine(JSON.stringify(result, null, 2));
  return CLI_SETTINGS.successStatuses.includes(result.status) ? 0 : 1;
}

function parseArguments(args) {
  const unknown = args.filter((arg) => arg !== CLI_SETTINGS.applyFlag);
  if (unknown.length > 0) {
    throw new Error(`unknown arguments: ${unknown.join(" ")} (only ${CLI_SETTINGS.applyFlag})`);
  }
  return { apply: args.includes(CLI_SETTINGS.applyFlag) };
}

function parseJson(text) {
  if (text.length === 0) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function readFixture() {
  const fixturePath = fileURLToPath(new URL(`./${CLI_SETTINGS.fixtureFile}`, import.meta.url));
  return JSON.parse(await readFile(fixturePath, "utf8"));
}

function resolveApiOrigin(rawUrl) {
  if (rawUrl === undefined || rawUrl.trim().length === 0) {
    throw new Error("BOOKNEST_API_URL is not set");
  }
  let parsed;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error("BOOKNEST_API_URL is not a valid URL");
  }
  const host = parsed.hostname.toLowerCase();
  if (CLI_SETTINGS.forbiddenHostMarkers.some((marker) => host.includes(marker))) {
    throw new Error(`refusing a non-dev host: ${host}`);
  }
  const hasExtras =
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.search !== "" ||
    parsed.hash !== "" ||
    parsed.pathname !== "/";
  if (hasExtras) {
    throw new Error("BOOKNEST_API_URL must be a bare origin such as https://dev.book-nest.net");
  }
  if (!CLI_SETTINGS.allowedOrigins.includes(parsed.origin)) {
    throw new Error(
      `refusing ${parsed.origin}; allowed: ${CLI_SETTINGS.allowedOrigins.join(", ")}`,
    );
  }
  return parsed.origin;
}

function writeLine(text) {
  process.stdout.write(`${text}\n`);
}

main().then(
  (exitCode) => {
    process.exitCode = exitCode;
  },
  (error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  },
);
