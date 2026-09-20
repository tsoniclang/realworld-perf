import { sumCsvAmounts, sumPrimes } from "./workloads.js";

function selectWorkload(
  benchmark: string,
  size: number,
  payload: string,
  readText: (path: string) => string,
  writeText: (path: string, contents: string) => void,
  fileSize: (path: string) => number,
): (iterations: number) => number {
  if (benchmark === "primes") {
    return (iterations: number): number => {
      let checksum = 0;
      for (let index = 0; index < iterations; index++) checksum += sumPrimes(size);
      return checksum;
    };
  }
  if (benchmark === "csv") {
    return (iterations: number): number => {
      let checksum = 0;
      for (let index = 0; index < iterations; index++) checksum += sumCsvAmounts(payload);
      return checksum;
    };
  }
  if (benchmark === "file-read") {
    return (iterations: number): number => {
      let checksum = 0;
      for (let index = 0; index < iterations; index++) checksum += readText("fixture.txt").length;
      return checksum;
    };
  }
  if (benchmark === "file-write") {
    return (iterations: number): number => {
      let checksum = 0;
      for (let index = 0; index < iterations; index++) {
        writeText("output.txt", payload);
        checksum += payload.length;
      }
      return checksum;
    };
  }
  if (benchmark === "file-stat") {
    return (iterations: number): number => {
      let checksum = 0;
      for (let index = 0; index < iterations; index++) checksum += fileSize("fixture.txt");
      return checksum;
    };
  }
  throw new Error("Unknown benchmark");
}

export function run(
  now: () => number,
  readText: (path: string) => string,
  writeText: (path: string, contents: string) => void,
  fileSize: (path: string) => number,
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
  const payload = readText("fixture.txt");
  const performBatch = selectWorkload(input.benchmark, input.size, payload, readText, writeText, fileSize);
  let warmupChecksum = 0;
  for (let batch = 0; batch < input.warmup; batch++) {
    warmupChecksum += performBatch(input.iterations);
  }
  const started = now();
  const checksum = performBatch(input.iterations);
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
