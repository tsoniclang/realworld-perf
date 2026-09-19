import { lanes, workloads } from "./catalog.mjs";

export function statistics(values) {
  if (values.length === 0 || values.some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new Error("Timing samples must be finite and positive.");
  }
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
  return { median, minimum: sorted[0], maximum: sorted.at(-1) };
}

export function validateResult(result, input, expected) {
  if (result === null || typeof result !== "object" ||
      result.benchmark !== input.benchmark || result.iterations !== input.iterations ||
      result.checksum !== expected * input.iterations ||
      result.warmupChecksum !== expected * input.iterations * input.warmup ||
      !Number.isFinite(result.elapsedMs) || result.elapsedMs <= 0) {
    throw new Error(`Incorrect result for ${input.benchmark}: ${JSON.stringify(result)}`);
  }
}

export function formatReport(record) {
  const lines = [
    "# Benchmark results", "", `Run: ${record.createdAt}`, "",
    `Status: ${record.failures.length === 0 ? "complete" : "INCOMPLETE — build or execution failures remain; not full certification"}.`, "",
    `Mode: ${record.verification ? "correctness smoke; not performance evidence" : "measured"}. Samples per cell: ${record.samples}. Warm-up batches per process: ${record.warmup}.`, "",
    "Times are median milliseconds per workload iteration. Parentheses are elapsed time / Node time; lower is better. Native means native I/O/clock APIs, not a different arithmetic or CSV algorithm.", "",
    "Both C# lanes use Release NativeAOT executables with Speed optimization, not managed DLLs or a JIT. Rust uses Cargo release; Node uses V8.", "",
    `| Workload | ${lanes.map((lane) => lane.label).join(" | ")} |`,
    `| --- | ${lanes.map(() => "---:").join(" | ")} |`,
  ];
  for (const workload of workloads) {
    const measured = lanes.map((lane) => {
      const values = record.measurements.filter((sample) => sample.benchmark === workload.id && sample.lane === lane.id)
        .map((sample) => sample.elapsedMs / sample.iterations);
      return values.length === record.samples ? statistics(values).median : undefined;
    });
    lines.push(`| ${workload.label} | ${measured.map((value, index) => value === undefined ? "FAILED — no certified timing" :
      `${value.toFixed(4)}${index === 0 || measured[0] === undefined ? "" : ` (${(value / measured[0]).toFixed(2)}×)`}`).join(" | ")} |`);
  }
  lines.push("", "## Environment", "", `- OS: ${record.machine.platform} ${record.machine.release} (${record.machine.arch})`,
    `- CPU: ${record.machine.cpu}`, `- Node: ${record.build.versions.node}; V8: ${record.build.versions.v8}`,
    `- TypeScript: ${record.build.versions.typescript}`, `- .NET SDK: ${record.build.versions.dotnetSdk}`,
    `- Rust: ${record.build.versions.rustc}`, `- Input fingerprint: ${record.build.fingerprint}`, "",
    "## Build and process wall time", "", "These values are not part of the timed workload. Process wall time includes startup, setup, warm-up, measured work and shutdown; it is not a pure startup measurement.", "",
    "| Lane | Generation ms | Native build ms | Median process wall ms |", "| --- | ---: | ---: | ---: |");
  for (const lane of lanes) {
    const timing = record.build.timings.find((value) => value.lane === lane.id);
    const values = record.measurements.filter((sample) => sample.lane === lane.id).map((sample) => sample.processWallMs);
    const processTime = values.length === workloads.length * record.samples ? statistics(values).median.toFixed(1) : "FAILED";
    lines.push(`| ${lane.label} | ${timing === undefined ? "FAILED" : timing.generationMs.toFixed(1)} | ${timing === undefined ? "FAILED" : timing.nativeBuildMs.toFixed(1)} | ${processTime} |`);
  }
  if (record.failures.length !== 0) {
    lines.push("", "## Failures", "");
    for (const failure of record.failures) lines.push(`### ${failure.lane}${failure.benchmark === undefined ? " build" : ` / ${failure.benchmark} / round ${failure.round + 1}`}`, "", "```text", failure.message, "```", "");
  }
  lines.push("", "Raw samples, ranges, payload hashes, iteration counts, build artifacts and toolchain details are in the adjacent JSON file. No failing or incorrect lane is included as a successful measurement.", "");
  return lines.join("\n");
}
