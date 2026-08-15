import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  computePackContents,
  readRecordedPackContents,
} from "../scripts/pack-contents.mjs";

const serverDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

// The Desktop Extension is committed to the repo and served from the Releases
// page, so a source change that never made it into a repack ships silently —
// which is how the .mcpb ended up twelve days behind master before 1.2.0.
test("media-pipeline.mcpb was packed from the current build", () => {
  assert.ok(
    fs.existsSync(path.join(serverDirectory, "media-pipeline.mcpb")),
    "media-pipeline.mcpb is missing — run `npm run pack:mcpb`"
  );

  const recorded = readRecordedPackContents();
  assert.ok(recorded, "mcpb-contents.json is missing — run `npm run pack:mcpb`");

  assert.deepEqual(
    computePackContents(),
    recorded,
    "the packed extension is out of date — run `npm run pack:mcpb`"
  );
});

test("the recorded pack matches the current version", () => {
  const packVersion = JSON.parse(
    fs.readFileSync(path.join(serverDirectory, "mcpb-contents.json"), "utf8")
  ).version;
  const packageVersion = JSON.parse(
    fs.readFileSync(path.join(serverDirectory, "package.json"), "utf8")
  ).version;

  assert.equal(
    packVersion,
    packageVersion,
    "the extension was packed at a different version — run `npm run pack:mcpb`"
  );
});
