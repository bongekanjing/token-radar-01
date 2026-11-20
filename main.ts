// token-radar-01 — entrypoint, rewritten for the radar-2 submission.
//
// What this file does, in plain terms: it takes the sealed DefiLlama
// snapshot, hands it to the radar-2 model in lib/model.ts, and lays out
// everything the judge reads under one output directory — the ranked
// board, the dashboard's data file, the static dashboard itself, the
// screenshots, and finally the dossier that summarises it all.
//
// Run it with Node 22 and nothing else installed (standard library
// only). Outside the grader, point MAKEFUN_OUTPUT_DIR at a scratch
// folder instead of /output, e.g.:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
//
// The flags are --input <snapshot.json or a directory holding one> and
// --output <directory>; both also accept the --flag=value spelling.
// Defaults are the grader's mounts: /input for the snapshot and
// /output (or MAKEFUN_OUTPUT_DIR) for the results.

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  boardIssue,
  buildRadar,
  dataScript,
  parseSnapshot,
} from "./lib/model.ts";
import { buildDossier } from "./vendor/makefun-board.ts";

// Where this file lives, so dashboard/ and screenshots/ are found
// relative to the repository rather than the working directory.
const repoRoot = fileURLToPath(new URL(".", import.meta.url));

// Limits the scorer enforces (see reference/gate.json in the kit):
// the dossier text cap, and how many screenshots, of what size, may
// be handed in. The text cap shapes the dossier bytes; the screenshot
// caps refuse an oversized hand-in outright.
const dossierLimits = {
  textMaxBytes: 65_536,
  screenshots: { max: 4, maxBytes: 524_288 },
  dashboard: { maxFiles: 400, maxBytes: 4_194_304 },
};

// A screenshot filename the gate accepts: letters, digits and
// . _ - , starting with a letter, digit or underscore, at most 128 chars.
const screenshotNameOk = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

// The hand-in needs at least these three views: the board, one
// protocol in detail, and the board with a filter applied.
const minScreenshots = 3;

function fail(message: string, code: number): never {
  process.stderr.write(`token radar: ${message}\n`);
  process.exit(code);
}

// Pull one named flag out of argv. Supports both spellings:
//   --input path   and   --input=path
// Returns `fallback` when the flag is absent entirely.
function flagValue(argv: string[], name: string, fallback: string): string {
  const spaced = argv.indexOf(`--${name}`);
  if (spaced >= 0 && spaced + 1 < argv.length) return argv[spaced + 1]!;
  const glued = argv.find((a) => a.startsWith(`--${name}=`));
  if (glued !== undefined) return glued.slice(name.length + 3);
  return fallback;
}

// Resolve the snapshot path: a .json path is used as-is, anything
// else is treated as a directory holding snapshot.json.
function snapshotPath(inputArg: string): string {
  return inputArg.endsWith(".json")
    ? inputArg
    : join(inputArg, "snapshot.json");
}

// Copy every plain file from one directory into another, skipping
// dotfiles, and report the names that landed. Missing source
// directories simply copy nothing.
function copyPlainFiles(sourceDir: string, destDir: string): string[] {
  if (!existsSync(sourceDir)) return [];
  mkdirSync(destDir, { recursive: true });
  const landed: string[] = [];
  for (const name of readdirSync(sourceDir)) {
    if (name.startsWith(".")) continue;
    const from = join(sourceDir, name);
    if (!statSync(from).isFile()) continue;
    copyFileSync(from, join(destDir, name));
    landed.push(name);
  }
  return landed;
}

function main(): void {
  const argv = process.argv.slice(2);

  const inputFile = snapshotPath(flagValue(argv, "input", "/input"));
  if (!existsSync(inputFile)) {
    fail(
      `no snapshot at ${inputFile}: pass --input <snapshot.json|directory> or mount the sealed /input`,
      2,
    );
  }
  const outDir = flagValue(
    argv,
    "output",
    process.env.MAKEFUN_OUTPUT_DIR ?? "/output",
  );

  // Score first, write nothing yet: a board the gate refuses should
  // fail before any output directory is created.
  const snapshot = parseSnapshot(readFileSync(inputFile, "utf8"));
  const { board, radar } = buildRadar(snapshot);
  const problem = boardIssue(board, snapshot);
  if (problem !== null) {
    fail(`the model wrote a board the gate refuses: ${problem}`, 1);
  }

  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, "board.json"),
    `${JSON.stringify({ rows: board })}\n`,
  );
  writeFileSync(join(outDir, "data.js"), dataScript(radar));

  // Keep the dashboard file count for the summary line instead of
  // assuming the directory always holds three files.
  const dashboardFiles = copyPlainFiles(
    join(repoRoot, "dashboard"),
    join(outDir, "dashboard"),
  );
  const screenshots = copyPlainFiles(
    join(repoRoot, "screenshots"),
    join(outDir, "screenshots"),
  );
  if (screenshots.length < minScreenshots) {
    fail(
      `screenshots/ holds ${screenshots.length} image${screenshots.length === 1 ? "" : "s"}: hand in 3, the board, a detail view and a filtered view`,
      1,
    );
  }
  for (const name of screenshots) {
    if (!screenshotNameOk.test(name)) {
      fail(
        `screenshots/${name}: a name is letters, digits and . _ -, 1 to 128 characters`,
        1,
      );
    }
  }

  // Dossier goes last on purpose: the scorer rebuilds it from this
  // very output directory and compares the bytes, so nothing may
  // change under it after it is written.
  writeFileSync(
    join(outDir, "dossier.json"),
    buildDossier(outDir, {
      text_max_bytes: dossierLimits.textMaxBytes,
      screenshots: {
        max: dossierLimits.screenshots.max,
        max_bytes: dossierLimits.screenshots.maxBytes,
      },
      dashboard: {
        max_files: dossierLimits.dashboard.maxFiles,
        max_bytes: dossierLimits.dashboard.maxBytes,
      },
    }),
  );

  const plural = (n: number) => (n === 1 ? "" : "s");
  process.stdout.write(
    `token radar: ${snapshot.protocols.length} protocols, ` +
      `${snapshot.watchlist.length} on the watchlist, ` +
      `${board.length} rows scored ` +
      `(${radar.early_size} early, ${radar.live_size} live set aside)\n` +
      `token radar: wrote ${join(outDir, "board.json")}, ` +
      `${join(outDir, "data.js")}, ${join(outDir, "dashboard")} (${dashboardFiles.length} file${plural(dashboardFiles.length)}), ` +
      `${join(outDir, "screenshots")} (${screenshots.length} image${plural(screenshots.length)}) ` +
      `and ${join(outDir, "dossier.json")}\n`,
  );
}

main();
