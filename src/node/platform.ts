import { readFileSync, statSync, writeFileSync } from "node:fs";
import { hrtime } from "node:process";

export function now(): number {
  const time = hrtime();
  return time[0] * 1000 + time[1] / 1000000;
}

export function readText(path: string): string {
  return readFileSync(path, "utf8");
}

export function writeText(path: string, contents: string): void {
  writeFileSync(path, contents, "utf8");
}

export function fileSize(path: string): number {
  return statSync(path).size;
}
