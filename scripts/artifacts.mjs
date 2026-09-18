import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { relative, resolve } from "node:path";
import { root } from "./process.mjs";

export function treeFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => entry.isDirectory() ? treeFiles(resolve(directory, entry.name)) : [resolve(directory, entry.name)]);
}

export function fileDigest(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function inputFingerprint() {
  const files = ["package.json", "package-lock.json", "tsconfig.node.json"].map((path) => resolve(root, path));
  for (const directory of ["src", "config", "scripts"]) files.push(...treeFiles(resolve(root, directory)));
  const hash = createHash("sha256");
  for (const path of files.sort()) hash.update(`${relative(root, path)}\0${fileDigest(path)}\0`);
  return hash.digest("hex");
}

export function verifyBuild() {
  const build = JSON.parse(readFileSync(resolve(root, "out/build.json"), "utf8"));
  if (build.fingerprint !== inputFingerprint()) throw new Error("Sources or dependencies changed. Run npm run build again.");
  for (const artifact of build.artifacts) {
    if (fileDigest(resolve(root, artifact.path)) !== artifact.sha256) {
      throw new Error(`Build artifact changed: ${artifact.path}. Run npm run build again.`);
    }
  }
  return build;
}
