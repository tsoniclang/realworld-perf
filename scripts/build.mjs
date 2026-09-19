import { mkdirSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { lanes } from "./catalog.mjs";
import { fileDigest, inputFingerprint, treeFiles } from "./artifacts.mjs";
import { root, runCommand } from "./process.mjs";

export function buildAll() {
  mkdirSync(resolve(root, "out"), { recursive: true });
  const logRoot = resolve(root, ".temp/builds", `${Date.now()}-${process.pid}`);
  const versions = {
    node: process.version,
    v8: process.versions.v8,
    typescript: runCommand(resolve(root, "node_modules/.bin/tsc"), ["--version"]).stdout.trim(),
    dotnetSdk: runCommand("dotnet", ["--version"]).stdout.trim(),
    dotnetRuntimes: runCommand("dotnet", ["--list-runtimes"]).stdout.trim(),
    rustc: runCommand("rustc", ["--version"]).stdout.trim(),
    cargo: runCommand("cargo", ["--version"]).stdout.trim(),
  };
  const failures = [];
  const timings = [];
  const artifacts = [];
  const fingerprint = inputFingerprint();
  for (const lane of lanes) {
    try {
      console.log(`Building ${lane.label}`);
      if (lane.kind === "node") {
        const compile = runCommand(resolve(root, "node_modules/.bin/tsc"), ["--project", "tsconfig.node.json"], { log: resolve(logRoot, `${lane.id}.log`) });
        timings.push({ lane: lane.id, generationMs: compile.wallMs, nativeBuildMs: 0 });
        artifacts.push(...treeFiles(resolve(root, "out/node")));
        continue;
      }
      const generated = runCommand(resolve(root, "node_modules/.bin/tsonic"), ["build", "--project", `tsonic.${lane.id}.json`], {
        log: resolve(logRoot, `${lane.id}-generate.log`),
        timeout: 900000,
      });
      let built;
      if (lane.kind === "csharp") {
        const project = resolve(root, "out", lane.id, "csharp", `${lane.assembly}.csproj`);
        const output = resolve(root, "out/bin", lane.id);
        built = runCommand("dotnet", ["build", project, "--configuration", "Release", "--nologo", "--disable-build-servers", "-m:1", "--output", output], { log: resolve(logRoot, `${lane.id}-build.log`) });
        artifacts.push(...treeFiles(output));
      } else {
        const project = resolve(root, "out", lane.id, "rust/Cargo.toml");
        built = runCommand("cargo", ["build", "--release", "--manifest-path", project], {
          env: { CARGO_BUILD_JOBS: "2", CARGO_TARGET_DIR: resolve(root, "out/cargo") },
          log: resolve(logRoot, `${lane.id}-build.log`),
        });
        artifacts.push(resolve(root, "out/cargo/release", lane.crate));
        artifacts.push(resolve(root, "out", lane.id, "rust/Cargo.lock"));
      }
      timings.push({ lane: lane.id, generationMs: generated.wallMs, nativeBuildMs: built.wallMs });
    } catch (error) {
      failures.push({ lane: lane.id, message: error.message });
      console.error(`${lane.id}: ${error.message}`);
    }
  }
  if (inputFingerprint() !== fingerprint) throw new Error("Build inputs changed during compilation; no build record written.");
  const record = {
    createdAt: new Date().toISOString(),
    fingerprint,
    versions,
    timings,
    failures,
    artifacts: artifacts.map((path) => ({ path: relative(root, path), sha256: fileDigest(path) })),
  };
  writeFileSync(resolve(root, "out/build.json"), `${JSON.stringify(record, null, 2)}\n`);
  console.log(`${timings.length}/${lanes.length} lanes built; ${failures.length} failed. Logs: ${logRoot}`);
  return record;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (buildAll().failures.length !== 0) process.exitCode = 1;
}
