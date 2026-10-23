import assert from "node:assert/strict";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const workerPath = resolve(projectRoot, "dist/server/index.js");
// Import from the generated directory so relative worker modules are resolved too.
const workerModule = await import(pathToFileURL(workerPath).href);
assert.equal(
  typeof workerModule.default?.fetch,
  "function",
  `${workerPath} must export default.fetch`,
);

console.log("Artifact is valid ESM and exports default.fetch");
