import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registryPath = path.join(root, "src", "features", "map", "regions.ts");
const mapAssetsPath = path.join(root, "public", "map");
const geometryLimit = 32 * 1024;
const textureLimit = 256 * 1024;
const failures = [];

const registry = await readFile(registryPath);
if (registry.byteLength > geometryLimit) {
  failures.push(
    `territory geometry is ${registry.byteLength} bytes, limit is ${geometryLimit}`,
  );
}

async function inspectDirectory(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }

  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await inspectDirectory(target);
      continue;
    }
    if (!entry.isFile()) continue;

    const details = await stat(target);
    if (details.size > textureLimit) {
      failures.push(
        `${path.relative(root, target)} is ${details.size} bytes, limit is ${textureLimit}`,
      );
    }
  }
}

await inspectDirectory(mapAssetsPath);

if (failures.length > 0) {
  for (const failure of failures) console.error(`map asset budget: ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    `map asset budget passed: geometry ${registry.byteLength}/${geometryLimit} bytes`,
  );
}
