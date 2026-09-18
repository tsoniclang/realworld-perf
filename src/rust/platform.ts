import { metadata, read_to_string, write } from "@tsonic/rust/std/fs.js";
import { Instant } from "@tsonic/rust/std/time.js";

const origin = Instant.now();

export function now(): number {
  return origin.elapsed().as_secs_f64() * 1000;
}

export function readText(path: string): string {
  return read_to_string<string>(path).unwrap();
}

export function writeText(path: string, contents: string): void {
  write<string, string>(path, contents).unwrap();
}

export function fileSize(path: string): number {
  return Number(metadata<string>(path).unwrap().len());
}
