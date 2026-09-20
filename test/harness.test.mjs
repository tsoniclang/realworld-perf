import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createFixture, expectedChecksum, laneOrder, lanes, workloads } from "../scripts/catalog.mjs";
import { readOptions, executionCommand } from "../scripts/benchmark.mjs";
import { csharpPublishArguments } from "../scripts/build.mjs";
import { formatReport, statistics, validateResult } from "../scripts/results.mjs";
import { runCommand } from "../scripts/process.mjs";
import { stripTypeScriptTypes } from "node:module";
import { createScanner } from "typescript/unstable/ast/scanner";

test("workload selection precedes both warmup and measured iteration", () => {
  for (const directory of ["shared", "native"]) {
    const source = readFileSync(new URL(`../src/${directory}/runner.ts`, import.meta.url), "utf8");
    assert.ok(source.indexOf("const performBatch = selectWorkload(") < source.indexOf("const started = now()"));
    assert.ok(source.includes(`const checksum = performBatch(${directory === "native" ? "iterations" : "input.iterations"})`));
    assert.doesNotMatch(source.slice(source.indexOf("const started = now()")), /selectWorkload|payload|benchmark ===/u);
    const stat = source.slice(source.indexOf('if (benchmark === "file-stat")'), source.indexOf('throw new Error("Unknown benchmark")'));
    assert.doesNotMatch(stat, /payload|readText|writeText/u);
    assert.match(stat, /for \(let index/u);
    assert.match(stat, /fileSize\("fixture.txt"\)/u);
  }
});

test("five workloads cover all five lanes with a real Node baseline", () => {
  assert.equal(workloads.length, 5);
  assert.equal(lanes.length, 5);
  assert.equal(lanes[0].id, "node");
  for (let round = 0; round < 5; round++) {
    assert.equal(laneOrder(round)[0].id, lanes[round].id);
    assert.deepEqual(laneOrder(round).map((lane) => lane.id).sort(), lanes.map((lane) => lane.id).sort());
  }
});

test("native annotations preserve exactly the same workload algorithms after type erasure", () => {
  const source = directory => readFileSync(new URL(`../src/${directory}/workloads.ts`, import.meta.url), "utf8");
  const erase = text => {
    const scanner = createScanner(true, undefined, stripTypeScriptTypes(text));
    const tokens = [];
    for (;;) {
      const kind = scanner.scan();
      const spelling = scanner.getTokenText();
      if (spelling.length === 0) break;
      tokens.push([kind, spelling, tokens.length > 0 && scanner.hasPrecedingLineBreak()]);
    }
    return tokens;
  };
  assert.deepEqual(erase(source("native")), erase(source("shared")));
  assert.match(source("native"), /candidate: int32/u);
  assert.match(source("native"), /divisor: int32/u);
  assert.match(source("native"), /index: int32/u);
  assert.doesNotMatch(source("shared"), /@tsonic|int32/u);
  for (const target of ["csharp", "rust"]) {
    assert.match(readFileSync(new URL(`../src/${target}/main.ts`, import.meta.url), "utf8"), /\.\.\/native\/runner\.js/u);
  }
  assert.match(readFileSync(new URL("../src/node/main.ts", import.meta.url), "utf8"), /\.\.\/shared\/runner\.js/u);
});

test("native numeric selection follows validation and does not narrow accumulated totals", () => {
  const runner = readFileSync(new URL("../src/native/runner.ts", import.meta.url), "utf8");
  assert.ok(runner.indexOf('throw new Error("Invalid benchmark dimensions")') < runner.indexOf("input.size as int32"));
  assert.match(runner, /let checksum = 0/u);
  assert.match(runner, /let warmupChecksum = 0/u);
  const source = readFileSync(new URL("../src/native/workloads.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /total: int32/u);
});

test("both C# lanes publish and execute NativeAOT rather than managed DLLs", () => {
  const args = csharpPublishArguments("project.csproj", "output");
  assert.equal(args[0], "publish");
  assert.ok(args.includes("--use-current-runtime"));
  assert.equal(args[args.indexOf("--configuration") + 1], "Release");
  assert.equal(args[args.indexOf("--self-contained") + 1], "true");
  assert.ok(args.includes("-p:IlcOptimizationPreference=Speed"));
  for (const lane of lanes.filter((candidate) => candidate.kind === "csharp")) {
    const config = JSON.parse(readFileSync(new URL(`../tsonic.${lane.id}.json`, import.meta.url), "utf8"));
    assert.equal(config.targets[0].options.publishAot, true);
    const execution = executionCommand(lane);
    assert.ok(execution.command.endsWith(`/out/native/${lane.id}/${lane.assembly}`));
    assert.deepEqual(execution.args, []);
    assert.doesNotMatch(execution.command, /\.dll$/u);
  }
  assert.throws(() => executionCommand({ id: "invalid", kind: "invalid" }), /Unknown execution lane/u);
});

test("fixtures have independent known answers, Unicode and exact byte counts", () => {
  const prime = createFixture(workloads[0], true);
  assert.equal(prime.expected, 1060);
  const csv = createFixture(workloads[1], true);
  assert.equal(csv.expected, 2312);
  assert.match(csv.payload, /café/u);
  const read = createFixture(workloads[2], true);
  const write = createFixture(workloads[3], true);
  const stat = createFixture(workloads[4], true);
  assert.equal(read.payload, write.payload);
  assert.equal(read.payload, stat.payload);
  assert.equal(read.expected, read.payload.length);
  assert.equal(stat.expected, Buffer.byteLength(stat.payload));
  assert.ok(stat.expected > read.expected);
  assert.throws(() => createFixture({ id: "unknown", size: 10, iterations: 1 }), /Unknown workload/u);
});

test("sample statistics do not mutate inputs and reject unusable clocks", () => {
  const values = [9, 1, 5, 3];
  assert.deepEqual(statistics(values), { median: 4, minimum: 1, maximum: 9 });
  assert.deepEqual(values, [9, 1, 5, 3]);
  assert.equal(statistics([5, 1, 3]).median, 3);
  for (const invalid of [[], [0], [-1], [NaN], [Infinity]]) assert.throws(() => statistics(invalid));
});

test("native string units have exact checksums without changing workloads or admitting the other unit", () => {
  for (const workload of workloads) {
    const fixture = createFixture(workload, true);
    for (const lane of lanes) {
      const lengthResult = workload.id === "file-read" || workload.id === "file-write";
      const expected = expectedChecksum(workload, fixture, lane);
      assert.equal(expected, lengthResult && lane.kind === "rust" ? Buffer.byteLength(fixture.payload) : fixture.expected);
      const input = { benchmark: workload.id, iterations: 3, warmup: 2 };
      const result = { benchmark: workload.id, iterations: 3, checksum: expected * 3, warmupChecksum: expected * 6, elapsedMs: 1 };
      assert.doesNotThrow(() => validateResult(result, input, expected));
      if (lengthResult) {
        const otherUnit = lane.kind === "rust" ? fixture.payload.length : Buffer.byteLength(fixture.payload);
        assert.notEqual(expected, otherUnit);
        assert.throws(() => validateResult({ ...result, checksum: otherUnit * 3 }, input, expected));
      }
    }
  }
  assert.throws(() => expectedChecksum(workloads[2], createFixture(workloads[2], true), { stringUnit: "unknown" }), /Unknown string unit/u);
});

test("argument validation rejects missing, conflicting and unbounded inputs", () => {
  assert.deepEqual(readOptions([]), { samples: 5, warmup: 2, verification: false });
  assert.deepEqual(readOptions(["--samples", "3", "--warmup", "0", "--verify"]), { samples: 3, warmup: 0, verification: true });
  for (const args of [["--samples"], ["--samples", "0"], ["--samples", "31"], ["--warmup", "-1"], ["--warmup", "11"], ["--samples", "2.5"], ["--wat"], ["--verify", "--verify"]]) assert.throws(() => readOptions(args));
});

test("result validation rejects incorrect, missing and nonfinite measurements", () => {
  const input = { benchmark: "primes", iterations: 3, warmup: 2 };
  const result = { benchmark: "primes", iterations: 3, checksum: 3180, warmupChecksum: 6360, elapsedMs: 1 };
  assert.doesNotThrow(() => validateResult(result, input, 1060));
  for (const invalid of [null, {}, { ...result, checksum: 3181 }, { ...result, warmupChecksum: 0 }, { ...result, benchmark: "csv" }, { ...result, iterations: 1 }, { ...result, elapsedMs: 0 }, { ...result, elapsedMs: NaN }]) assert.throws(() => validateResult(invalid, input, 1060));
});

test("child failures and timeouts cannot become successful samples", () => {
  assert.throws(() => runCommand(process.execPath, ["-e", "process.exit(7)"]), /failed/u);
  assert.throws(() => runCommand(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { timeout: 30 }), /failed/u);
});

test("reports include Node and every lane without hiding build or startup costs", () => {
  const measurements = workloads.flatMap((workload) => lanes.map((lane, index) => ({ benchmark: workload.id, lane: lane.id, iterations: 1, elapsedMs: index + 1, processWallMs: 20 })));
  const report = formatReport({
    createdAt: "test", samples: 1, warmup: 1, verification: true, measurements, failures: [],
    machine: { platform: "linux", release: "test", arch: "x64", cpu: "test" },
    build: { versions: { node: "test", v8: "test", typescript: "test", dotnetSdk: "test", rustc: "test" }, fingerprint: "test", timings: lanes.map((lane) => ({ lane: lane.id, generationMs: 2, nativeBuildMs: 3 })) },
  });
  for (const lane of lanes) assert.ok(report.includes(lane.label));
  assert.match(report, /not performance evidence/u);
  assert.match(report, /not a pure startup measurement/u);
  assert.match(report, /5\.00×/u);
});

test("incomplete reports keep failed lanes visible without inventing timings or ratios", () => {
  const record = {
    createdAt: "test", samples: 2, warmup: 1, verification: false,
    measurements: workloads.flatMap((workload) => lanes.slice(1, 4).flatMap((lane) => [0, 1].map((round) => ({
      benchmark: workload.id, lane: lane.id, round, iterations: 1, elapsedMs: 1, processWallMs: 10,
    })))),
    failures: [{ lane: "rust-native", message: "build rejected" }, { lane: "node", benchmark: "primes", round: 0, message: "execution rejected" }],
    machine: { platform: "linux", release: "test", arch: "x64", cpu: "test" },
    build: { versions: { node: "test", v8: "test", typescript: "test", dotnetSdk: "test", rustc: "test" }, fingerprint: "test", timings: lanes.slice(0, 4).map((lane) => ({ lane: lane.id, generationMs: 1, nativeBuildMs: 1 })) },
  };
  const report = formatReport(record);
  for (const lane of lanes) assert.ok(report.includes(lane.label));
  assert.match(report, /INCOMPLETE/u);
  assert.match(report, /build rejected/u);
  assert.match(report, /execution rejected/u);
  assert.match(report, /FAILED — no certified timing/u);
  assert.doesNotMatch(report, /×|NaN|Infinity/u);
  record.measurements.pop();
  assert.match(formatReport(record), /Read file metadata \| FAILED — no certified timing \| 1\.0000 \| 1\.0000 \| FAILED — no certified timing/u);
});
