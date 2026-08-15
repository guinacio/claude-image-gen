import test from "node:test";
import assert from "node:assert/strict";
import { findVersionMismatches } from "../scripts/sync-version.mjs";

// PRs #5 and #6 shipped without a version bump, so the manifests silently fell
// behind the code. This is the guard that turns that class of drift into a test
// failure instead of something noticed after the release goes out.
test("every manifest matches the version in mcp-server/package.json", () => {
  const { version, mismatches } = findVersionMismatches();

  assert.match(version, /^\d+\.\d+\.\d+$/, "package.json holds a semver version");
  assert.deepEqual(
    mismatches,
    [],
    `run \`npm run sync:version\` — drift against ${version}: ${mismatches
      .map(({ label, found }) => `${label} at ${found.join(", ")}`)
      .join("; ")}`
  );
});
