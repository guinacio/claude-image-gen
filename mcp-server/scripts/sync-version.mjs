#!/usr/bin/env node
// The version in mcp-server/package.json is the single source of truth. Every
// other manifest is derived from it by this script, which runs automatically on
// `npm version` and is verified with --check before packing and on every test
// run, so the manifests and the lockfile cannot drift apart again.
//
// Versions are rewritten textually rather than by re-serialising the parsed
// document, because a JSON round trip would reformat inline arrays and produce
// a diff far larger than the one line that actually changed. Every write is
// re-read and verified afterwards, so a pattern that stops matching fails loudly
// instead of silently leaving a file behind.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = path.resolve(serverDirectory, "..");

const SOURCE_LABEL = "mcp-server/package.json";
const SOURCE_FILE = path.join(serverDirectory, "package.json");

/**
 * Each target names the file, how to read every version it holds, and a pattern
 * matching exactly those version values in the raw text. `occurrences` states
 * how many matches the pattern must find, so a structural change to a file is
 * caught rather than silently under-applied.
 */
const TARGETS = [
  {
    label: "mcp-server/package-lock.json",
    filePath: path.join(serverDirectory, "package-lock.json"),
    read: (document) => [document.version, document.packages?.[""]?.version],
    // Both the lockfile root and its own entry in `packages` are preceded by the
    // package name; dependency entries carry a different name.
    pattern: /("name":\s*"media-pipeline-mcp",\s*\n\s*"version":\s*")[^"]*(")/g,
    occurrences: 2,
  },
  {
    label: "mcp-server/manifest.json",
    filePath: path.join(serverDirectory, "manifest.json"),
    read: (document) => [document.version],
    // Anchored to a top-level field, so nested "version" keys are left alone.
    pattern: /^(  "version":\s*")[^"]*(")/gm,
    occurrences: 1,
  },
  {
    label: ".claude-plugin/plugin.json",
    filePath: path.join(repositoryRoot, ".claude-plugin", "plugin.json"),
    read: (document) => [document.version],
    pattern: /^(  "version":\s*")[^"]*(")/gm,
    occurrences: 1,
  },
  {
    label: ".claude-plugin/marketplace.json",
    filePath: path.join(repositoryRoot, ".claude-plugin", "marketplace.json"),
    read: (document) => document.plugins.map((plugin) => plugin.version),
    // One entry per plugin, nested two levels inside the plugins array.
    pattern: /^(      "version":\s*")[^"]*(")/gm,
    occurrences: 1,
  },
];

function readVersions(target) {
  return target.read(JSON.parse(fs.readFileSync(target.filePath, "utf8")));
}

/**
 * Returns one entry per target whose versions do not all match the source, so
 * the check and the sync path work from the same comparison.
 */
export function findVersionMismatches() {
  const version = JSON.parse(fs.readFileSync(SOURCE_FILE, "utf8")).version;

  const mismatches = TARGETS.flatMap((target) => {
    const found = readVersions(target);
    return found.some((candidate) => candidate !== version)
      ? [{ label: target.label, found }]
      : [];
  });

  return { version, mismatches };
}

function applyVersion(target, version) {
  const original = fs.readFileSync(target.filePath, "utf8");
  const matched = original.match(target.pattern)?.length ?? 0;

  if (matched !== target.occurrences) {
    throw new Error(
      `Expected ${target.occurrences} version field(s) in ${target.label}, found ${matched}. ` +
        "The file's shape changed; update the pattern in scripts/sync-version.mjs."
    );
  }

  fs.writeFileSync(
    target.filePath,
    original.replace(target.pattern, `$1${version}$2`)
  );

  const written = readVersions(target);
  if (written.some((candidate) => candidate !== version)) {
    throw new Error(
      `${target.label} still reads ${written.join(", ")} after the rewrite.`
    );
  }
}

function main() {
  const checkOnly = process.argv.includes("--check");
  const { version, mismatches } = findVersionMismatches();

  if (mismatches.length === 0) {
    console.log(`All manifests are at ${version}.`);
    return;
  }

  if (checkOnly) {
    console.error(
      `Version drift against ${SOURCE_LABEL} (${version}):\n` +
        mismatches
          .map(({ label, found }) => `  ${label}: ${found.join(", ")}`)
          .join("\n") +
        "\n\nRun `npm run sync:version` to bring them back in line."
    );
    process.exit(1);
  }

  for (const { label } of mismatches) {
    applyVersion(
      TARGETS.find((target) => target.label === label),
      version
    );
  }

  console.log(
    `Synced ${mismatches.map(({ label }) => label).join(", ")} to ${version}.`
  );
}

// Only act when run as a command; the test suite imports findVersionMismatches.
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main();
}
