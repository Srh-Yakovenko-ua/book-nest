import { spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const MAX_FINDINGS = 8;

const input = JSON.parse(readFileSync(0, "utf8"));
const projectDir =
  process.env.CLAUDE_PROJECT_DIR ?? join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const filePath = (input.tool_input?.file_path ?? "").replaceAll("\\", "/");
if (!filePath) process.exit(0);

recordEditedFile();

const scope = {
  schema: /\/apps\/api\/prisma\/schema\.prisma$/,
  messages: /\/apps\/web\/src\/messages\/[^/]+\.json$/,
  code: /\/(apps\/(api|web)|packages\/shared)\/src\/.+\.(ts|tsx|mts|cts)$/,
  generated: /\/(apps\/api\/src\/generated|apps\/web\/src\/shared\/api\/generated)\//,
  api: /\/apps\/api\/src\//,
  web: /\/apps\/web\/src\//,
  apiOutsideRepositories: /\/apps\/api\/src\/modules\/[^/]+\/(api|application|domain)\//,
  apiPureLayers: /\/apps\/api\/src\/modules\/[^/]+\/(application|domain)\//,
  test: /(\.test\.|\.spec\.|\.fixtures?\.|\/test\/|\/__tests__\/|test-utils)/,
  stories: /\.stories\.tsx?$/,
  envReaders: /\/(config\/env|lib\/env)\.ts$/,
};

if (scope.schema.test(filePath)) regeneratePrismaClient();
if (scope.messages.test(filePath)) checkLocaleParity();
if (!scope.code.test(filePath) || scope.generated.test(filePath)) process.exit(0);

const isTest = scope.test.test(filePath);
const isStory = scope.stories.test(filePath);
const isTsx = filePath.endsWith(".tsx");
const isApi = scope.api.test(filePath);
const isWeb = scope.web.test(filePath);

const rules = [
  {
    when: true,
    on: "raw",
    pattern:
      /^\s*(\/\/|\/\*|\{\/\*)(?!\s*(eslint-|@ts-expect-error|prettier-ignore|@vitest-environment|biome-ignore))(?!\/\s*<reference)/,
    message: "comment (CLAUDE.md 8.1: rename until the code explains itself)",
    dedupe: "line",
  },
  {
    when: true,
    on: "code",
    pattern: /(:\s*any\b|\bas\s+any\b|<any>|\bany\[\])/,
    message: "`any` (parse with Zod at the boundary, trust the type inside)",
  },
  {
    when: true,
    on: "code",
    pattern: /[\w)\]]!(?=[.[);,])/,
    message: "non-null `!` (narrow with an early return or a type guard)",
  },
  {
    when: true,
    on: "code",
    pattern: isApi ? /\bconsole\.(log|debug|info|warn|error)\(/ : /\bconsole\.(log|debug)\(/,
    message: isApi
      ? 'console.* (createLogger("scope") from core/logger.ts)'
      : "console.log left in",
  },
  {
    when: true,
    on: "code",
    pattern:
      /(\.getTime\(\)|Date\.now\(\)\s*[-+]|\b(60\s*\*\s*60|24\s*\*\s*60|1000\s*\*\s*60|60\s*\*\s*1000|86_?400_?000|864e5|3_?600_?000)\b|\.set(UTC)?(FullYear|Month|Date|Hours|Minutes|Seconds|Milliseconds|Time)\(|new Date\(\s*[\w.]+\s*,)/,
    message:
      "hand-rolled date math (date-fns: isAfter, addDays, differenceInDays, milliseconds({ days }))",
  },
  {
    when: !isTest && !scope.envReaders.test(filePath),
    on: "code",
    pattern: /\bprocess\.env\b(?!\.NODE_ENV\b)/,
    message:
      "process.env outside config/env.ts / lib/env.ts (add the variable to the Zod env schema)",
  },
  {
    when: !isTest && scope.apiOutsideRepositories.test(filePath),
    on: "code",
    pattern: /\bPrismaService\b|\bthis\.prisma\b/,
    message: "Prisma outside infrastructure/ (only repositories touch Prisma)",
  },
  {
    when: !isTest && scope.apiPureLayers.test(filePath),
    on: "code",
    pattern: /@(Req|Res)\(|from\s+["']express["']/,
    message: "req/res in a service or domain file (services know nothing about HTTP)",
  },
  {
    when: isWeb && isTsx && !isTest && !isStory,
    on: "code",
    pattern: /(^|[^\w.])fetch\(/,
    message: "fetch in a component (go through the feature's api/ and the generated Orval hooks)",
  },
  {
    when: isWeb && !isTest && !isStory,
    on: "code",
    pattern: /\b(useMemo|useCallback)\s*\(|\bReact\.memo\(|(^|[^\w.])memo\(/,
    message:
      "memoization (CLAUDE.md 8.6: only with a measurement; drop it or name the measurement)",
  },
  {
    when: isWeb && !isTest,
    on: "raw",
    pattern:
      /\b[a-z][\w:-]*(?<!tracking)-\[(-?\d*\.?\d+(px|rem|em)|#[0-9a-fA-F]{3,8}|(rgba?|hsla?|oklch)\()/,
    message:
      "arbitrary Tailwind value (snap to the scale: mb-4, text-sm, rounded-md, bg-primary; keep [..] only when no step fits, and say why)",
  },
  {
    when: isWeb && isTsx && !isTest && !isStory,
    on: "raw",
    pattern: /[Ѐ-ӿ]/,
    message:
      "Cyrillic in a component (user-facing copy goes through messages/{uk,en}.json, /add-i18n-key)",
    dedupe: "line",
  },
];

const fileLines = safeRead(filePath).split("\n");
const previous = previousText();
const findings = addedLines().flatMap((line) => {
  const code = stripStrings(line);
  return rules.flatMap((rule) => {
    if (!rule.when) return [];
    const match = (rule.on === "raw" ? line : code).match(rule.pattern);
    if (!match) return [];
    if (rule.dedupe !== "line" && previous.includes(match[0])) return [];
    return [{ line, message: rule.message }];
  });
});

if (findings.length === 0) process.exit(0);

const report = findings.slice(0, MAX_FINDINGS).map(({ line, message }) => {
  const lineNumber = fileLines.indexOf(line) + 1;
  const location = lineNumber > 0 ? `:${lineNumber}` : "";
  return `- ${relative(projectDir, filePath)}${location} ${message}: ${line.trim().slice(0, 90)}`;
});
if (findings.length > MAX_FINDINGS) report.push(`- +${findings.length - MAX_FINDINGS} more`);
report.push("Fix these in this file now, or state in one line why a finding is a false positive.");
console.error(report.join("\n"));
process.exit(2);

function addedLines() {
  const previousLines = new Set(previous.split("\n").map((line) => line.trim()));
  return writtenText()
    .split("\n")
    .filter((line) => line.trim() !== "" && !previousLines.has(line.trim()));
}

function writtenText() {
  const toolInput = input.tool_input ?? {};
  if (typeof toolInput.content === "string") return toolInput.content;
  if (Array.isArray(toolInput.edits))
    return toolInput.edits.map((edit) => edit.new_string ?? "").join("\n");
  return toolInput.new_string ?? "";
}

function previousText() {
  const toolInput = input.tool_input ?? {};
  if (typeof toolInput.content === "string") {
    const original = input.tool_response?.originalFile;
    return typeof original === "string" ? original : "";
  }
  if (Array.isArray(toolInput.edits))
    return toolInput.edits.map((edit) => edit.old_string ?? "").join("\n");
  return toolInput.old_string ?? "";
}

function stripStrings(line) {
  return line
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, "``");
}

function safeRead(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

function recordEditedFile() {
  const sessionId = input.session_id;
  if (!sessionId) return;
  try {
    const stateDir = join(projectDir, ".claude", "state", sessionId);
    mkdirSync(stateDir, { recursive: true });
    appendFileSync(join(stateDir, "edited.log"), `${filePath}\n`);
  } catch {
    return;
  }
}

function regeneratePrismaClient() {
  const apiDir = filePath.replace(/\/prisma\/schema\.prisma$/, "");
  const result = spawnSync("pnpm", ["db:generate"], {
    cwd: apiDir,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  if (result.status === 0) process.exit(0);
  const output = `${result.error?.message ?? ""}${result.stdout ?? ""}${result.stderr ?? ""}`
    .trim()
    .split("\n")
    .slice(-15)
    .join("\n");
  console.error(`prisma generate failed after the schema edit:\n${output}`);
  process.exit(2);
}

function checkLocaleParity() {
  const result = spawnSync(
    "node",
    [join(projectDir, ".claude", "scripts", "check-i18n-parity.mjs")],
    {
      cwd: projectDir,
      encoding: "utf8",
    },
  );
  if (result.status === 0) process.exit(0);
  console.error(
    `${(result.stderr ?? "").trim()}\nAdd the key to every locale file (/add-i18n-key).`,
  );
  process.exit(2);
}
