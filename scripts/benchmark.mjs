import { createHash } from "node:crypto";
import { cpus, arch, platform, release, totalmem } from "node:os";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createFixture, laneOrder, workloads } from "./catalog.mjs";
import { verifyBuild } from "./artifacts.mjs";
import { root, runCommand } from "./process.mjs";
import { formatReport, statistics, validateResult } from "./results.mjs";

export function readOptions(args) {
  const options = { samples: 5, warmup: 2, verification: false };
  const seen = new Set();
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (seen.has(argument)) throw new Error(`Repeated option: ${argument}`);
    seen.add(argument);
    if (argument === "--verify") options.verification = true;
    else if (argument === "--samples" || argument === "--warmup") {
      const value = args[++index];
      if (value === undefined || !/^\d+$/u.test(value)) throw new Error(`Invalid ${argument}`);
      const count = Number(value);
      if (!Number.isSafeInteger(count) || count < (argument === "--samples" ? 1 : 0) || count > (argument === "--samples" ? 30 : 10)) throw new Error(`Out of range: ${argument}`);
      options[argument === "--samples" ? "samples" : "warmup"] = count;
    } else throw new Error(`Unknown option: ${argument}`);
  }
  return options;
}

export function benchmark(options) {
  const build = verifyBuild();
  if (build.versions.node !== process.version || build.versions.rustc !== runCommand("rustc", ["--version"]).stdout.trim() ||
      build.versions.dotnetRuntimes !== runCommand("dotnet", ["--list-runtimes"]).stdout.trim()) {
    throw new Error("Execution toolchains changed since build; rebuild before comparing.");
  }
  mkdirSync(resolve(root, ".temp/runs"), { recursive: true });
  const workRoot = mkdtempSync(resolve(root, ".temp/runs/run-"));
  const record = {
    createdAt: new Date().toISOString(), ...options,
    machine: { platform: platform(), release: release(), arch: arch(), cpu: cpus()[0]?.model ?? "unknown", logicalCpus: cpus().length, memoryBytes: totalmem() },
    build, measurements: [], summary: [],
  };
  const failures = [];
  for (const workload of workloads) {
    const fixture = createFixture(workload, options.verification);
    const input = { benchmark: workload.id, size: fixture.size, iterations: fixture.iterations, warmup: options.warmup };
    const payloadHash = createHash("sha256").update(fixture.payload).digest("hex");
    for (let round = 0; round < options.samples; round++) {
      for (const lane of laneOrder(round)) {
        const cwd = resolve(workRoot, `${workload.id}-${round}-${lane.id}`);
        mkdirSync(cwd);
        writeFileSync(resolve(cwd, "input.json"), JSON.stringify(input));
        writeFileSync(resolve(cwd, "fixture.txt"), fixture.payload);
        try {
          const command = lane.kind === "node" ? process.execPath : lane.kind === "csharp" ? "dotnet" : resolve(root, "out/cargo/release", lane.crate);
          const args = lane.kind === "node" ? [resolve(root, "scripts/node-entry.mjs")] : lane.kind === "csharp" ? [resolve(root, "out/bin", lane.id, `${lane.assembly}.dll`)] : [];
          const child = runCommand(command, args, { cwd, timeout: 60000, log: resolve(cwd, "process.log") });
          if (child.stderr.trim() !== "") throw new Error(`Unexpected stderr: ${child.stderr}`);
          const result = JSON.parse(child.stdout.trim());
          validateResult(result, input, fixture.expected);
          if (workload.id === "file-write" && !readFileSync(resolve(cwd, "output.txt")).equals(Buffer.from(fixture.payload))) {
            throw new Error("Written bytes differ from the UTF-8 fixture.");
          }
          record.measurements.push({ ...result, lane: lane.id, round, processWallMs: child.wallMs, size: fixture.size, fixtureBytes: Buffer.byteLength(fixture.payload), fixtureSha256: payloadHash });
          console.log(`${workload.id} ${lane.id} ${round + 1}/${options.samples}: ${result.elapsedMs.toFixed(3)} ms; correct`);
        } catch (error) {
          failures.push(`${workload.id}/${lane.id}/${round}: ${error.message}`);
          console.error(failures.at(-1));
        }
      }
    }
  }
  if (failures.length !== 0) throw new Error(`${failures.length} benchmark invocation(s) failed. No performance report published. Evidence: ${workRoot}\n${failures.join("\n")}`);
  for (const workload of workloads) {
    for (const lane of laneOrder(0)) {
      record.summary.push({ benchmark: workload.id, lane: lane.id, ...statistics(record.measurements.filter((sample) => sample.benchmark === workload.id && sample.lane === lane.id).map((sample) => sample.elapsedMs / sample.iterations)) });
    }
  }
  mkdirSync(resolve(root, "results"), { recursive: true });
  const output = resolve(root, "results", `${record.createdAt.replaceAll(":", "-")}-${options.verification ? "verify" : "bench"}`);
  writeFileSync(`${output}.json`, `${JSON.stringify(record, null, 2)}\n`, { flag: "wx" });
  writeFileSync(`${output}.md`, formatReport(record), { flag: "wx" });
  console.log(`Passed ${record.measurements.length} invocations. Report: ${output}.md`);
  return record;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) benchmark(readOptions(process.argv.slice(2)));
