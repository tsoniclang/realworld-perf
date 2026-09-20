export const lanes = Object.freeze([
  { id: "node", label: "Node.js", kind: "node", stringUnit: "utf16-units" },
  { id: "csharp-node", label: "C# NativeAOT Node APIs", kind: "csharp", assembly: "BenchNodeCsharp", stringUnit: "utf16-units" },
  { id: "rust-node", label: "Rust Node APIs", kind: "rust", crate: "bench_node_rust", stringUnit: "utf8-bytes" },
  { id: "csharp-native", label: "C# NativeAOT native APIs", kind: "csharp", assembly: "BenchNativeCsharp", stringUnit: "utf16-units" },
  { id: "rust-native", label: "Rust native APIs", kind: "rust", crate: "bench_native_rust", stringUnit: "utf8-bytes" },
].map(Object.freeze));

export const workloads = Object.freeze([
  { id: "primes", label: "Prime summation", size: 10000, iterations: 100 },
  { id: "csv", label: "CSV aggregation", size: 2000, iterations: 100 },
  { id: "file-read", label: "Read UTF-8 file", size: 65536, iterations: 500 },
  { id: "file-write", label: "Write UTF-8 file", size: 65536, iterations: 200 },
  { id: "file-stat", label: "Read file metadata", size: 65536, iterations: 10000 },
].map(Object.freeze));

export function createFixture(workload, verification = false) {
  const size = verification ? (workload.id === "primes" ? 100 : 17) : workload.size;
  const iterations = verification ? 3 : workload.iterations;
  let payload = "";
  let expected = 0;
  if (workload.id === "csv") {
    for (let index = 0; index < size; index++) {
      const amount = (index * 17) % 997;
      payload += `${index},café-${index % 7},${amount}\n`;
      expected += amount;
    }
  } else {
    payload = "café 😀\n".repeat(size).slice(0, size);
    if (payload.length > 0 && /[\uD800-\uDBFF]$/u.test(payload)) payload += "\uDE00";
    expected = payload.length;
    if (workload.id === "primes") {
      expected = 0;
      const composite = new Uint8Array(size + 1);
      for (let prime = 2; prime <= size; prime++) {
        if (composite[prime] !== 0) continue;
        expected += prime;
        for (let multiple = prime * prime; multiple <= size; multiple += prime) composite[multiple] = 1;
      }
    } else if (workload.id === "file-stat") {
      expected = Buffer.byteLength(payload, "utf8");
    } else if (workload.id !== "file-read" && workload.id !== "file-write") {
      throw new Error(`Unknown workload '${workload.id}'.`);
    }
  }
  return { size, iterations, payload, expected };
}

export function laneOrder(round) {
  const offset = round % lanes.length;
  return [...lanes.slice(offset), ...lanes.slice(0, offset)];
}

export function expectedChecksum(workload, fixture, lane) {
  if (workload.id !== "file-read" && workload.id !== "file-write") return fixture.expected;
  if (lane.stringUnit === "utf8-bytes") return Buffer.byteLength(fixture.payload, "utf8");
  if (lane.stringUnit === "utf16-units") return fixture.payload.length;
  throw new Error(`Unknown string unit '${lane.stringUnit}'.`);
}
