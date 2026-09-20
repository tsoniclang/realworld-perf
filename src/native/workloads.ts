import type { int32 } from "@tsonic/core/types.js";

export function sumPrimes(limit: int32): number {
  let total = 0;
  for (let candidate: int32 = 2; candidate <= limit; candidate++) {
    let prime = true;
    for (let divisor: int32 = 2; divisor * divisor <= candidate; divisor++) {
      if (candidate % divisor === 0) {
        prime = false;
        break;
      }
    }
    if (prime) total += candidate;
  }
  return total;
}

export function sumCsvAmounts(contents: string): number {
  const lines = contents.split("\n");
  let total = 0;
  for (let index: int32 = 0; index < lines.length; index++) {
    const line = lines[index];
    if (line.length === 0) continue;
    const fields = line.split(",");
    total += parseInt(fields[2], 10);
  }
  return total;
}
