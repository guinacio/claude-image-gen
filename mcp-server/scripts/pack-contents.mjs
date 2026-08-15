#!/usr/bin/env node
// Records what went into media-pipeline.mcpb, so a stale extension cannot ship.
//
// The archive itself is not byte-reproducible — the zip stores timestamps, so
// two packs of identical sources differ — which rules out checksumming the
// .mcpb. Instead the pack step records a hash per packed file, and the test
// suite recomputes them: rebuild without repacking and the hashes diverge.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const RECORD_FILE = path.join(serverDirectory, "mcpb-contents.json");

// Everything .mcpbignore leaves behind. Kept explicit so that a change to what
// the extension ships has to be made here too, rather than silently widening.
const PACKED_FILES = [
  "build/bundle.js",
  "build/cli.bundle.js",
  "icon.png",
  "manifest.json",
];

function hashFile(relativePath) {
  const data = fs.readFileSync(path.join(serverDirectory, relativePath));
  return crypto.createHash("sha256").update(data).digest("hex");
}

export function computePackContents() {
  return Object.fromEntries(PACKED_FILES.map((file) => [file, hashFile(file)]));
}

export function readRecordedPackContents() {
  if (!fs.existsSync(RECORD_FILE)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(RECORD_FILE, "utf8")).files;
}

function main() {
  const version = JSON.parse(
    fs.readFileSync(path.join(serverDirectory, "package.json"), "utf8")
  ).version;

  fs.writeFileSync(
    RECORD_FILE,
    `${JSON.stringify({ version, files: computePackContents() }, null, 2)}\n`
  );

  console.log(`Recorded ${PACKED_FILES.length} packed files for ${version}.`);
}

// Only act when run as a command; the test suite imports the helpers.
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main();
}
