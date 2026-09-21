import { readFileSync, statSync, writeFileSync } from "node:fs";
import { hrtime } from "node:process";

export function now(): number {
  const time = hrtime();
  return time[0] * 1000 + time[1] / 1000000;
}

export function readText(path: string): string {
  return readFileSync(path, "utf8");
}

export function createReader(path: string): () => string {
  return (): string => readFileSync(path, "utf8");
}

export function createWriter(path: string, contents: string): () => void {
  return (): void => { writeFileSync(path, contents, "utf8"); };
}

export function createStat(path: string): () => number {
  return (): number => statSync(path).size;
}
