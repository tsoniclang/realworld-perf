import type { int32 } from "@tsonic/core/types.js";
import { sumCsvAmounts, sumPrimes } from "./workloads.js";

function selectWorkload(
  benchmark: string,
  size: int32,
  payload: string,
  createReader: (path: string) => () => string,
  createWriter: (path: string, contents: string) => () => void,
  createStat: (path: string) => () => number,
): (iterations: int32) => number {
  if (benchmark === "primes") {
    return (iterations: int32): number => {
      let checksum = 0;
      for (let index: int32 = 0; index < iterations; index++) checksum += sumPrimes(size);
      return checksum;
    };
  }
  if (benchmark === "csv") {
    return (iterations: int32): number => {
      let checksum = 0;
      for (let index: int32 = 0; index < iterations; index++) checksum += sumCsvAmounts(payload);
      return checksum;
    };
  }
  if (benchmark === "file-read") {
    const read = createReader("fixture.txt");
    return (iterations: int32): number => {
      let checksum = 0;
      for (let index: int32 = 0; index < iterations; index++) checksum += read().length;
      return checksum;
    };
  }
  if (benchmark === "file-write") {
    const write = createWriter("output.txt", payload);
    const length = payload.length;
    return (iterations: int32): number => {
      let checksum = 0;
      for (let index: int32 = 0; index < iterations; index++) {
        write();
        checksum += length;
      }
      return checksum;
    };
  }
  if (benchmark === "file-stat") {
    const stat = createStat("fixture.txt");
    return (iterations: int32): number => {
      let checksum = 0;
      for (let index: int32 = 0; index < iterations; index++) checksum += stat();
      return checksum;
    };
  }
  throw new Error("Unknown benchmark");
}

export function run(
  now: () => number,
  readText: (path: string) => string,
  createReader: (path: string) => () => string,
  createWriter: (path: string, contents: string) => () => void,
  createStat: (path: string) => () => number,
): void {
  const fields = readText("input.txt").split("\n");
  if (fields.length !== 4) throw new Error("Expected four benchmark input fields");
  const input = {
    benchmark: fields[0],
    size: parseInt(fields[1], 10),
    iterations: parseInt(fields[2], 10),
    warmup: parseInt(fields[3], 10),
  };
  if (input.size.toString() !== fields[1] || input.iterations.toString() !== fields[2] ||
      input.warmup.toString() !== fields[3]) {
    throw new Error("Expected canonical integer input fields");
  }
  if (!Number.isSafeInteger(input.size) || input.size < 1 || input.size > 1000000 ||
      !Number.isSafeInteger(input.iterations) || input.iterations < 1 || input.iterations > 1000000 ||
      !Number.isSafeInteger(input.warmup) || input.warmup < 0 || input.warmup > 100) {
    throw new Error("Invalid benchmark dimensions");
  }
  const size = input.size as int32;
  const iterations = input.iterations as int32;
  const warmup = input.warmup as int32;
  const payload = readText("fixture.txt");
  const performBatch = selectWorkload(input.benchmark, size, payload, createReader, createWriter, createStat);
  let warmupChecksum = 0;
  for (let batch: int32 = 0; batch < warmup; batch++) {
    warmupChecksum += performBatch(iterations);
  }
  const started = now();
  const checksum = performBatch(iterations);
  const elapsedMs = now() - started;
  const output = JSON.stringify({
    benchmark: input.benchmark,
    iterations: input.iterations,
    checksum,
    warmupChecksum,
    elapsedMs,
  });
  if (output === undefined) throw new Error("Could not serialize benchmark result");
  console.log(output);
}
